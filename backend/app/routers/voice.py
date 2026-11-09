import os
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.auth import require_user_id


router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"audio/wav", "audio/x-wav", "audio/mp4", "audio/webm"}


class TranscriptionResponse(BaseModel):
    transcript: str
    mode: Literal["mock"] = "mock"


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
    _user_id: str = Depends(require_user_id),
):
    try:
        if os.getenv("VOICE_TRANSCRIPTION_MODE") != "mock":
            raise HTTPException(status_code=503, detail="음성 전사가 비활성화돼 있습니다.")

        content_type = (audio.content_type or "").split(";", 1)[0].strip().lower()
        if content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=415, detail="WAV, M4A 또는 WebM 파일을 올려주세요.")

        data = await audio.read(MAX_AUDIO_BYTES + 1)
        if not data:
            raise HTTPException(status_code=422, detail="음성 파일이 비어 있습니다.")
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="음성 파일은 10 MiB 이하여야 합니다.")

        return TranscriptionResponse(
            transcript="팀원들과 프로젝트 회의를 하고 위치 조회 기능을 테스트했다.",
        )
    finally:
        await audio.close()