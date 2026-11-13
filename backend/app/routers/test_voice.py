import asyncio
import io
import unittest
import wave
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import voice
from app.services import voice_transcription


def wav_bytes(rate=24000):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(b"\x01\x00" * 240)
    return buffer.getvalue()


class VoiceAdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_wav_passes_raw_pcm_and_eof_to_existing_stt(self):
        async def fake_transcribe(queue, sample_rate, language, on_transcript, *, api_key):
            self.assertEqual(await queue.get(), b"\x01\x00" * 240)
            self.assertIsNone(await queue.get())
            self.assertEqual((sample_rate, language, api_key), (24000, "ko", "test"))
            return "전사 결과"

        with patch.object(voice_transcription, "transcribe", side_effect=fake_transcribe):
            result = await voice_transcription.transcribe_wav(wav_bytes(), api_key="test")

        self.assertEqual(result, "전사 결과")


class VoiceApiTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(voice.router)
        self.addCleanup(app.dependency_overrides.clear)
        self.app = app
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def upload(self, content=None, mime="audio/wav"):
        return self.client.post(
            "/api/voice/transcribe",
            files={"audio": ("audio.wav", wav_bytes() if content is None else content, mime)},
        )

    def authenticate(self):
        self.app.dependency_overrides[voice.require_user_id] = lambda: "test-user"

    def test_no_token_returns_401_without_stt(self):
        with patch.object(voice, "transcribe_wav", new_callable=AsyncMock) as stt:
            self.assertEqual(self.upload().status_code, 401)
            stt.assert_not_awaited()

    def test_mock_preserves_upload_contract_without_stt(self):
        self.authenticate()
        with (
            patch.dict("os.environ", {"VOICE_TRANSCRIPTION_MODE": "mock"}),
            patch.object(voice, "transcribe_wav", new_callable=AsyncMock) as stt,
        ):
            response = self.upload(b"sample", "audio/mp4")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mode"], "mock")
        stt.assert_not_awaited()

    def test_openai_returns_transcript(self):
        self.authenticate()
        with (
            patch.dict("os.environ", {"VOICE_TRANSCRIPTION_MODE": "openai", "OPENAI_API_KEY": "test"}),
            patch.object(voice_transcription, "transcribe", new_callable=AsyncMock) as stt,
        ):
            stt.return_value = "전사 결과"
            response = self.upload()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"transcript": "전사 결과", "mode": "openai"})
        stt.assert_awaited_once()

    def test_invalid_audio_never_reaches_provider(self):
        self.authenticate()
        with (
            patch.dict("os.environ", {"VOICE_TRANSCRIPTION_MODE": "openai", "OPENAI_API_KEY": "test"}),
            patch.object(voice_transcription, "transcribe", new_callable=AsyncMock) as stt,
        ):
            self.assertEqual(self.upload(b"sample", "audio/webm").status_code, 415)
            self.assertEqual(self.upload(b"not a WAV").status_code, 422)
            self.assertEqual(self.upload(wav_bytes(rate=16000)).status_code, 422)
            self.assertEqual(self.upload(wav_bytes()[:-2]).status_code, 422)
            stt.assert_not_awaited()

    def test_provider_timeout_returns_504(self):
        self.authenticate()
        with (
            patch.dict("os.environ", {"VOICE_TRANSCRIPTION_MODE": "openai", "OPENAI_API_KEY": "test"}),
            patch.object(
                voice, "transcribe_wav", new=AsyncMock(side_effect=asyncio.TimeoutError)
            ),
        ):
            self.assertEqual(self.upload().status_code, 504)
