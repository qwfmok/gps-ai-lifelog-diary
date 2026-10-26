import asyncio
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import base64
import json
from backend.stt import stt_cli as main, stt_services as services


class FakeSocket:
    def __init__(self, reverse=False, fail=False):
        self.events = asyncio.Queue()
        self.sent = []
        self.commits = 0
        self.reverse = reverse
        self.fail = fail

    async def send(self, message):
        event = json.loads(message)
        self.sent.append(event)
        kind = event["type"]
        if kind == "session.update":
            await self.events.put({"type": "error" if self.fail else "session.updated"})
        elif kind == "input_audio_buffer.append":
            await self.events.put({"type": "conversation.item.input_audio_transcription.delta",
                                   "item_id": f"item_{self.commits + 1}", "delta": "임시"})
        elif kind == "input_audio_buffer.commit":
            self.commits += 1
            await self.events.put({"type": "input_audio_buffer.committed",
                                   "item_id": f"item_{self.commits}"})
            if self.reverse:
                if self.commits == 2:
                    await self.complete(2)
                    await self.complete(1)
            else:
                await self.complete(self.commits)

    async def complete(self, number):
        await self.events.put({"type": "conversation.item.input_audio_transcription.completed",
                               "item_id": f"item_{number}", "transcript": f"문장{number}"})

    async def recv(self):
        return json.dumps(await self.events.get())


class STTTests(unittest.IsolatedAsyncioTestCase):
    async def test_final_result_after_eof_replaces_interim(self):
        queue = asyncio.Queue()
        await queue.put(bytes(4800))
        await queue.put(None)
        socket, callback = FakeSocket(), AsyncMock()
        text = await services.transcribe_connection(socket, queue, "ko", callback)
        self.assertEqual(text, "문장1")
        self.assertEqual(socket.commits, 1)
        self.assertEqual(callback.await_args.args, ("문장1", ""))
        self.assertEqual(socket.sent[0]["session"]["audio"]["input"]["transcription"]["languages"], ["ko"])

    async def test_interim_is_delivered_before_input_ends(self):
        queue = asyncio.Queue()
        await queue.put(bytes(4800))
        async def callback(final, interim):
            if interim:
                await queue.put(None)
        text = await asyncio.wait_for(services.transcribe_connection(FakeSocket(), queue, "ko", callback), 2)
        self.assertEqual(text, "문장1")

    async def test_out_of_order_completions_keep_audio_order(self):
        queue = asyncio.Queue()
        await queue.put(bytes(services.COMMIT_BYTES))
        await queue.put(bytes(4800))
        await queue.put(None)
        text = await services.transcribe_connection(FakeSocket(reverse=True), queue, "ko", AsyncMock())
        self.assertEqual(text, "문장1 문장2")

    async def test_empty_audio_does_not_commit(self):
        queue = asyncio.Queue()
        await queue.put(None)
        socket = FakeSocket()
        self.assertEqual(await services.transcribe_connection(socket, queue, "ko", AsyncMock()), "")
        self.assertEqual(socket.commits, 0)

    async def test_short_audio_is_padded_for_final_commit(self):
        queue = asyncio.Queue()
        await queue.put(bytes(2))
        await queue.put(None)
        socket = FakeSocket()
        await services.transcribe_connection(socket, queue, "ko", AsyncMock())
        appended = [base64.b64decode(e["audio"]) for e in socket.sent if e["type"] == "input_audio_buffer.append"]
        self.assertEqual(sum(map(len, appended)), 4800)

    async def test_session_error_is_reported(self):
        with self.assertRaises(RuntimeError):
            await services.transcribe_connection(FakeSocket(fail=True), asyncio.Queue(), "ko", AsyncMock())

    async def test_user_prompt_is_passed_verbatim(self):
        create = AsyncMock(return_value=SimpleNamespace(status="completed", output_text="교정 결과"))
        client = AsyncMock()
        client.__aenter__.return_value = SimpleNamespace(responses=SimpleNamespace(create=create))
        prompt = "  나의 지침\n줄바꿈을 유지  "
        with patch.object(services, "AsyncOpenAI", return_value=client):
            actual = await services.correct_text("원문", prompt, model="test-model", api_key="test")
        self.assertEqual(actual, "교정 결과")
        create.assert_awaited_once_with(model="test-model", instructions=prompt, input="원문", store=False)

    async def test_incomplete_correction_is_not_returned(self):
        client = AsyncMock()
        client.__aenter__.return_value.responses.create.return_value = SimpleNamespace(status="incomplete", output_text="일부")
        with patch.object(services, "AsyncOpenAI", return_value=client):
            with self.assertRaises(RuntimeError):
                await services.correct_text("원문", "지침", model="test", api_key="test")

    async def test_blank_prompt_does_not_call_api(self):
        with patch.object(services, "AsyncOpenAI") as client:
            with self.assertRaises(ValueError):
                await services.correct_text("원문", " \n", model="test", api_key="test")
            client.assert_not_called()

    async def test_correction_runs_after_recording_and_preserves_raw_on_failure(self):
        events = []
        async def record(args, callback):
            events.append("record")
            await callback("확정 원문", "임시")
            events.append("finished")
            return "확정 원문"
        async def correct(*args, **kwargs):
            self.assertEqual(events, ["record", "finished"])
            raise RuntimeError("simulated failure")
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(output_dir=Path(directory), text_file=None, model="test")
            with patch.object(main, "record", side_effect=record), patch.object(main, "correct_text", side_effect=correct):
                with self.assertRaises(RuntimeError):
                    await main.run(args, "지침")
            raw_files = list(Path(directory).glob("*.raw.txt"))
            self.assertEqual(len(raw_files), 1)
            self.assertEqual(raw_files[0].read_text(encoding="utf-8"), "확정 원문")
            self.assertEqual(list(Path(directory).glob("*.corrected.txt")), [])

    async def test_silence_skips_gpt(self):
        with tempfile.TemporaryDirectory() as directory:
            args = SimpleNamespace(output_dir=Path(directory), text_file=None, model="test")
            with patch.object(main, "record", new=AsyncMock(return_value="")), patch.object(main, "correct_text", new=AsyncMock()) as correct:
                await main.run(args, "지침")
                correct.assert_not_awaited()

    async def test_record_closes_microphone_before_sending_eof(self):
        closed = False
        class Microphone:
            def __init__(self, **kwargs):
                self.callback = kwargs["callback"]
            def __enter__(self):
                self.callback(b"\x00\x00", 1, None, "")
                return self
            def __exit__(self, *args):
                nonlocal closed
                closed = True
        async def transcribe(queue, rate, language, callback, **kwargs):
            self.assertEqual(await queue.get(), b"\x00\x00")
            self.assertIsNone(await queue.get())
            self.assertTrue(closed)
            return "마지막 문장"
        args = SimpleNamespace(language="ko", device=None, stt_model=services.STT_MODEL)
        with patch.object(main.sd, "RawInputStream", Microphone), patch.object(main, "transcribe", side_effect=transcribe), patch.object(main, "wait_for_enter", new=AsyncMock()):
            self.assertEqual(await main.record(args, AsyncMock()), "마지막 문장")


if __name__ == "__main__":
    unittest.main()
