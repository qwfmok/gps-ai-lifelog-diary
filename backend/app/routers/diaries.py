import os
from openai import OpenAIError
from asyncio import to_thread
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.services.diary_generator import generate_diary_draft
from app.schemas.diary import (
    DiaryGenerateRequest,
    DiaryGenerateResponse,
)


router = APIRouter(
    prefix="/api/diaries",
    tags=["diaries"],
)
DIARY_COLUMNS = "id,diary_date,content,created_at,updated_at"

@router.post("/generate", response_model=DiaryGenerateResponse)
async def generate_diary(
    data: DiaryGenerateRequest,
    _user_id: str = Depends(require_user_id),
):
    memo = data.memo.strip()
    if not 1 <= len(memo) <= 4000:
        raise HTTPException(status_code=422, detail="메모를 1~4000자로 입력하세요.")

    if data.location_ids:
        raise HTTPException(
            status_code=422,
            detail="현재는 메모만 지원합니다. location_ids는 빈 배열로 보내세요.",
        )

    mode = os.getenv("DIARY_GENERATION_MODE", "mock")
    if mode == "mock":
        draft = memo
    elif mode == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        model = os.getenv("OPENAI_DIARY_MODEL")
        if not api_key or not model:
            raise HTTPException(status_code=503, detail="일기 생성 설정이 필요합니다.")

        try:
            draft = await generate_diary_draft(memo, api_key=api_key, model=model)
        except (OpenAIError, ValueError):
            raise HTTPException(
                status_code=502,
                detail="일기 초안을 생성하지 못했습니다.",
            ) from None
    else:
        raise HTTPException(status_code=503, detail="일기 생성 모드 설정이 잘못됐습니다.")

    return DiaryGenerateResponse(
        generated_diary=draft,
        used_facts=[memo],
        uncertain_points=[],
    )

class DiaryContent(BaseModel):
    content: str = Field(min_length=1, max_length=20000)

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value):
        return value.strip() if isinstance(value, str) else value


class DiaryCreate(DiaryContent):
    diary_date: date


class DiaryResponse(DiaryContent):
    id: UUID
    diary_date: date
    created_at: datetime
    updated_at: datetime


@router.post("", response_model=DiaryResponse, status_code=201)
async def create_diary(
    payload: DiaryCreate,
    user_id: str = Depends(require_user_id),
):
    query = supabase.table("diaries").insert({
        "user_id": user_id,
        "diary_date": payload.diary_date.isoformat(),
        "content": payload.content,
    })
    result = await to_thread(query.execute)
    return result.data[0]


@router.get("", response_model=list[DiaryResponse])
async def list_diaries(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(require_user_id),
):
    query = (
        supabase.table("diaries")
        .select(DIARY_COLUMNS)
        .eq("user_id", user_id)
        .order("diary_date", desc=True)
        .order("created_at", desc=True)
        .order("id", desc=True)
        .range(offset, offset + limit - 1)
    )
    result = await to_thread(query.execute)
    return result.data


@router.get("/{diary_id}", response_model=DiaryResponse)
async def get_diary(
    diary_id: UUID,
    user_id: str = Depends(require_user_id),
):
    query = (
        supabase.table("diaries")
        .select(DIARY_COLUMNS)
        .eq("user_id", user_id)
        .eq("id", str(diary_id))
        .limit(1)
    )
    result = await to_thread(query.execute)
    if not result.data:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    return result.data[0]


@router.patch("/{diary_id}", response_model=DiaryResponse)
async def update_diary(
    diary_id: UUID,
    payload: DiaryContent,
    user_id: str = Depends(require_user_id),
):
    query = (
        supabase.table("diaries")
        .update({
            "content": payload.content,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("user_id", user_id)
        .eq("id", str(diary_id))
    )
    result = await to_thread(query.execute)
    if not result.data:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    return result.data[0]


@router.delete("/{diary_id}", status_code=204, response_class=Response)
async def delete_diary(
    diary_id: UUID,
    user_id: str = Depends(require_user_id),
):
    query = (
        supabase.table("diaries")
        .delete()
        .eq("user_id", user_id)
        .eq("id", str(diary_id))
    )
    result = await to_thread(query.execute)
    if not result.data:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    return Response(status_code=204)