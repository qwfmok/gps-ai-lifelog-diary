import json
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
from app.services.diary_places import resolve_diary_places
from app.services.place_inference import enrich_stays_with_places
from app.schemas.diary import (
    DiaryCurrentLocation,
    DiaryGenerateRequest,
    DiaryGenerateResponse,
)
from app.routers.stay_points import KST, build_daily_stays
from app.routers.timeline import load_timeline_notes


router = APIRouter(
    prefix="/api/diaries",
    tags=["diaries"],
)
DIARY_COLUMNS = "id,diary_date,content,created_at,updated_at"

async def load_diary_context(
    diary_date: date,
    user_id: str,
    current_location: DiaryCurrentLocation | None,
    *,
    api_key: str | None,
    model: str | None,
) -> dict:
    stays = await build_daily_stays(diary_date, user_id, include_place_candidates=True)
    notes = await load_timeline_notes(diary_date, user_id)
    current = []
    if current_location is not None:
        current = await enrich_stays_with_places(
            [current_location.model_dump(mode="json")], include_place_candidates=True
        )
    places = await resolve_diary_places(stays + current, api_key=api_key, model=model)

    return {
        "date": diary_date.isoformat(),
        "stays": [
            {
                **place,
                "started_at": stay["started_at"],
                "ended_at": stay["ended_at"],
                "duration_minutes": stay["duration_minutes"],
            }
            for stay, place in zip(stays, places)
        ],
        "current_location": (
            {**places[-1], "recorded_at": current[0]["recorded_at"]} if current else None
        ),
        "notes": [row["note"] for row in notes],
    }
    
@router.post("/generate", response_model=DiaryGenerateResponse)
async def generate_diary(
    data: DiaryGenerateRequest,
    user_id: str = Depends(require_user_id),
):
    memo = data.memo.strip()
    transcript = (data.transcript or "").strip()

    if len(memo) > 4000:
        raise HTTPException(status_code=422, detail="메모는 4000자 이하여야 합니다.")
    if data.location_ids:
        raise HTTPException(status_code=422, detail="location_ids 대신 diary_date를 사용하세요.")
    if data.current_location and data.current_location.recorded_at.astimezone(KST).date() != data.diary_date:
        raise HTTPException(status_code=422, detail="현재 위치는 일기 날짜에 확인한 위치만 사용할 수 있습니다.")

    mode = os.getenv("DIARY_GENERATION_MODE", "mock")
    if mode not in {"mock", "openai"}:
        raise HTTPException(status_code=503, detail="일기 생성 모드 설정이 잘못됐습니다.")

    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_DIARY_MODEL")
    if mode == "openai" and (not api_key or not model):
        raise HTTPException(status_code=503, detail="일기 생성 설정이 필요합니다.")

    context = {"date": None, "stays": [], "current_location": None, "notes": []}
    if data.diary_date is not None:
        context = await load_diary_context(
            data.diary_date, user_id, data.current_location,
            api_key=api_key if mode == "openai" else None, model=model,
        )

    facts = [text for text in (memo, transcript) if text]
    uncertain_points = []
    for stay in context["stays"]:
        label = stay["address"]
        if stay["place_inferred"]:
            uncertain_points.append(f"체류 장소 추정 · {stay['place_name']}")
        elif stay["place_name"]:
            label = stay["place_name"]
        else:
            uncertain_points.append(f"체류 장소 미확인 · {label or '주소 미확인'}")
        facts.append(f"{label or '장소 미확인 위치'}에서 {stay['duration_minutes']:g}분 체류")
    current = context["current_location"]
    if current:
        if current["place_inferred"]:
            uncertain_points.append(f"현재 장소 추정 · {current['place_name']}")
        else:
            uncertain_points.append("현재 위치의 장소 이름을 특정하지 못했습니다.")
        address = current["address"]
        facts.append(f"현재 위치 확인 · {address}" if address else "현재 위치를 확인함")
    facts.extend(context["notes"])

    if not facts:
        raise HTTPException(status_code=422, detail="일기에 사용할 기록이 없습니다.")

    if mode == "mock":
        draft = "\n".join(facts)
    else:
        # 메모 단독 요청은 기존 방식으로 처리합니다.
        generation_input = memo
        if data.diary_date is not None or transcript:
            generation_input = json.dumps(
                {**context, "memo": memo, "transcript": transcript},
                ensure_ascii=False,
            )

        try:
            draft = await generate_diary_draft(
                generation_input,
                api_key=api_key,
                model=model,
                use_context=data.diary_date is not None or bool(transcript),
            )
        except (OpenAIError, ValueError):
            raise HTTPException(
                status_code=502, detail="일기 초안을 생성하지 못했습니다."
            ) from None

    return DiaryGenerateResponse(
        generated_diary=draft,
        used_facts=facts,
        uncertain_points=list(dict.fromkeys(uncertain_points)),
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
