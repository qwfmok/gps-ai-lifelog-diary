from asyncio import to_thread
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from app.core.auth import require_user_id
from app.db.supabase import supabase

from app.schemas.diary import (
    DiaryGenerateRequest,
    DiaryGenerateResponse,
)


router = APIRouter(
    prefix="/api/diaries",
    tags=["diaries"],
)


@router.post(
    "/generate",
    response_model=DiaryGenerateResponse
)
async def generate_diary(data: DiaryGenerateRequest):
    return DiaryGenerateResponse(
        generated_diary=(
            "오늘은 친구와 카페에서 프로젝트에 관해 이야기를 나눴다."
        ),
        used_facts=[
            "카페에서 프로젝트 회의를 함"
        ],
        uncertain_points=[]
    )

DIARY_COLUMNS = "id,diary_date,content,created_at,updated_at"


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