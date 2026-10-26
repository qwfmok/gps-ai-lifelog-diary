"""OpenAI realtime STT and user-prompt text correction, independent of UI."""
import asyncio
import base64
import json

from openai import AsyncOpenAI
from websockets.asyncio.client import connect

MAX_SECONDS = 240
SAMPLE_RATE = 24000
STT_MODEL = "gpt-live-transcribe"
COMMIT_BYTES = SAMPLE_RATE * 2 * 15


def check_error(event):
    if event.get("type") in {"error", "conversation.item.input_audio_transcription.failed"}:
        raise RuntimeError("OpenAI 음성 인식 요청이 실패했습니다. API 키·모델 접근 권한·사용 한도를 확인해 주세요.")


async def transcribe(queue, sample_rate, language, on_transcript, *, api_key, model=STT_MODEL):
    """Stream mono PCM16 LE bytes from queue; None ends input and drains finals."""
    if not api_key:
        raise ValueError("OPENAI_API_KEY를 설정해 주세요.")
    if sample_rate != SAMPLE_RATE:
        raise ValueError("OpenAI 실시간 전사는 24,000 Hz PCM16 mono 입력이 필요합니다.")
    async with connect(
        "wss://api.openai.com/v1/realtime?intent=transcription",
        additional_headers={"Authorization": f"Bearer {api_key}"},
        open_timeout=15, close_timeout=5, max_size=2**22,
    ) as ws:
        return await transcribe_connection(ws, queue, language, on_transcript, model=model)


async def transcribe_connection(ws, queue, language, on_transcript, *, model=STT_MODEL):
    """Track committed items separately from text events, which can arrive out of order."""
    await ws.send(json.dumps({
        "type": "session.update",
        "session": {"type": "transcription", "audio": {"input": {
            "format": {"type": "audio/pcm", "rate": SAMPLE_RATE},
            "transcription": {"model": model, "languages": [language]},
            "turn_detection": None,
        }}},
    }))
    async with asyncio.timeout(15):
        while True:
            event = json.loads(await ws.recv())
            check_error(event)
            if event.get("type") == "session.updated":
                break

    order, finals, deltas = [], {}, {}
    changed = asyncio.Event()

    async def publish():
        final_parts, pending_parts = [], []
        blocked = False
        for item in order:
            if not blocked and item in finals:
                final_parts.append(finals[item])
            else:
                blocked = True
                pending_parts.append(finals.get(item, deltas.get(item, "")))
        pending_parts.extend(text for item, text in deltas.items() if item not in order)
        await on_transcript(" ".join(final_parts).strip(), " ".join(pending_parts).strip())

    async def receive():
        while True:
            event = json.loads(await ws.recv())
            check_error(event)
            kind, item = event.get("type"), event.get("item_id")
            if kind == "input_audio_buffer.committed":
                if item not in order:
                    order.append(item)
            elif kind == "conversation.item.input_audio_transcription.delta":
                if item not in finals:
                    deltas[item] = deltas.get(item, "") + event["delta"]
            elif kind == "conversation.item.input_audio_transcription.completed":
                finals[item] = event["transcript"]
                deltas.pop(item, None)
            else:
                continue
            await publish()
            changed.set()

    async def send():
        buffered = commits = 0
        while True:
            chunk = await queue.get()
            if chunk is None:
                if buffered:
                    # The API needs at least 100 ms for a commit.
                    if buffered < SAMPLE_RATE // 10 * 2:
                        padding = bytes(SAMPLE_RATE // 10 * 2 - buffered)
                        await ws.send(json.dumps({"type": "input_audio_buffer.append",
                                                  "audio": base64.b64encode(padding).decode("ascii")}))
                    await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
                    commits += 1
                return commits
            if len(chunk) % 2:
                raise ValueError("PCM16 음성 데이터의 길이는 짝수여야 합니다.")
            # Bound each message and periodically finalize turns for saved transcripts.
            for offset in range(0, len(chunk), SAMPLE_RATE // 10 * 2):
                part = chunk[offset:offset + SAMPLE_RATE // 10 * 2]
                await ws.send(json.dumps({"type": "input_audio_buffer.append",
                                          "audio": base64.b64encode(part).decode("ascii")}))
                buffered += len(part)
                if buffered >= COMMIT_BYTES:
                    await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
                    commits += 1
                    buffered = 0

    sender, receiver = asyncio.create_task(send()), asyncio.create_task(receive())
    waiter = None
    try:
        done, _ = await asyncio.wait([sender, receiver], return_when=asyncio.FIRST_COMPLETED)
        if receiver in done:
            await receiver
            raise RuntimeError("OpenAI 음성 인식 연결이 종료되었습니다.")
        count = await sender

        async def wait_for_finals():
            while True:
                changed.clear()
                if len(order) == count and all(item in finals for item in order):
                    return " ".join(finals[item] for item in order).strip()
                await changed.wait()

        waiter = asyncio.create_task(wait_for_finals())
        done, _ = await asyncio.wait([waiter, receiver], timeout=20, return_when=asyncio.FIRST_COMPLETED)
        if receiver in done:
            await receiver
        if waiter not in done:
            raise TimeoutError("최종 음성 인식 결과 대기 시간이 초과되었습니다.")
        return await waiter
    finally:
        tasks = [sender, receiver] + ([waiter] if waiter else [])
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def correct_text(text, prompt, *, model, api_key):
    """Pass the user's prompt unchanged. Call only after STT has finished."""
    if not text.strip() or not prompt.strip():
        raise ValueError("원문과 교정 프롬프트가 모두 필요합니다.")
    if not api_key:
        raise ValueError("OPENAI_API_KEY를 설정해 주세요.")
    async with AsyncOpenAI(api_key=api_key, timeout=90, max_retries=0) as client:
        response = await client.responses.create(
            model=model, instructions=prompt, input=text, store=False,
        )
    if response.status != "completed" or not response.output_text.strip():
        raise RuntimeError("GPT가 완성된 교정문을 반환하지 않았습니다.")
    return response.output_text
