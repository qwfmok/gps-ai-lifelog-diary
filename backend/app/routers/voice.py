import asyncio
import logging
import os
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from websockets.exceptions import WebSocketException

from app.core.auth import require_user_id
from app.services.voice_transcription import InvalidWav, transcribe_wav


router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
WAV_TYPES = {"audio/wav", "audio/x-wav", "audio/wave"}
ALLOWED_TYPES = WAV_TYPES | {"audio/mp4", "audio/webm"}
logger = logging.getLogger(__name__)


class TranscriptionResponse(BaseModel):
    transcript: str
    mode: Literal["mock", "openai"] = "mock"


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
    _user_id: str = Depends(require_user_id),
):
    try:
        mode = os.getenv("VOICE_TRANSCRIPTION_MODE", "disabled")
        if mode not in {"mock", "openai"}:
            raise HTTPException(status_code=503, detail="음성 전사가 비활성화돼 있습니다.")

        content_type = (audio.content_type or "").split(";", 1)[0].strip().lower()
        if mode == "openai" and content_type not in WAV_TYPES:
            raise HTTPException(status_code=415, detail="실제 전사는 현재 24 kHz 모노 PCM16 WAV만 지원합니다.")
        if mode == "mock" and content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=415, detail="WAV, M4A 또는 WebM 파일을 올려주세요.")

        data = await audio.read(MAX_AUDIO_BYTES + 1)
        if not data:
            raise HTTPException(status_code=422, detail="음성 파일이 비어 있습니다.")
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="음성 파일은 10 MiB 이하여야 합니다.")

        if mode == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise HTTPException(status_code=503, detail="음성 전사 설정이 필요합니다.")

            try:
                transcript = (await transcribe_wav(data, api_key=api_key)).strip()
            except InvalidWav as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from None
            except (asyncio.TimeoutError, TimeoutError):
                raise HTTPException(status_code=504, detail="음성 전사 시간이 초과됐습니다.") from None
            except (OSError, RuntimeError, ValueError, WebSocketException) as exc:
                logger.warning("Voice transcription failed: %s", type(exc).__name__)
                raise HTTPException(status_code=502, detail="음성 전사에 실패했습니다.") from None

            if not transcript:
                raise HTTPException(status_code=422, detail="음성에서 인식된 문장이 없습니다.")
            return TranscriptionResponse(transcript=transcript, mode="openai")

        return TranscriptionResponse(
            transcript="팀원들과 프로젝트 회의를 하고 위치 조회 기능을 테스트했다.",
        )
    finally:
        await audio.close()
