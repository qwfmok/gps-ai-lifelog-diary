from asyncio import to_thread
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.routers.stay_points import build_daily_stays
from app.schemas.stay_point import StayPointResponse


router = APIRouter(prefix="/api/timeline", tags=["timeline"])


class TimelineItemResponse(StayPointResponse):
    id: str


class TimelineNoteCreate(BaseModel):
    date: date
    anchor_location_id: UUID
    note: str = Field(min_length=1, max_length=2000)

    @field_validator("note", mode="before")
    @classmethod
    def strip_note(cls, value):
        return value.strip() if isinstance(value, str) else value


class TimelineNoteResponse(BaseModel):
    id: UUID
    anchor_location_id: UUID
    stay_started_at: datetime
    stay_ended_at: datetime
    note: str
    created_at: datetime


@router.get("", response_model=list[TimelineItemResponse])
async def get_timeline(
    target_date: date = Query(..., alias="date"),
    user_id: str = Depends(require_user_id),
):
    stays = await build_daily_stays(target_date, user_id)
    return [{**stay, "id": stay["anchor_location_id"]} for stay in stays]


@router.post(
    "/notes",
    response_model=TimelineNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_timeline_note(
    payload: TimelineNoteCreate,
    user_id: str = Depends(require_user_id),
):
    stays = await build_daily_stays(payload.date, user_id)
    anchor_id = str(payload.anchor_location_id)

    stay = next(
        (item for item in stays if item["anchor_location_id"] == anchor_id),
        None,
    )
    if stay is None:
        raise HTTPException(status_code=404, detail="체류 기록을 찾을 수 없습니다.")

    data = {
        "user_id": user_id,
        "anchor_location_id": anchor_id,
        "stay_started_at": stay["started_at"],
        "stay_ended_at": stay["ended_at"],
        "note": payload.note,
    }

    query = supabase.table("timeline_notes").insert(data)
    result = await to_thread(query.execute)
    return result.data[0]

async def load_timeline_notes(target_date: date, user_id: str):
    kst = timezone(timedelta(hours=9))
    start = datetime.combine(target_date, time.min, tzinfo=kst)
    end = start + timedelta(days=1)

    query = (
        supabase
        .table("timeline_notes")
        .select("id,anchor_location_id,stay_started_at,stay_ended_at,note,created_at")
        .eq("user_id", user_id)
        .gte("stay_started_at", start.astimezone(timezone.utc).isoformat())
        .lt("stay_started_at", end.astimezone(timezone.utc).isoformat())
        .order("stay_started_at")
        .order("created_at")
        .order("id")
    )

    result = await to_thread(query.execute)
    return result.data

@router.get("/notes", response_model=list[TimelineNoteResponse])
async def get_timeline_notes(
    target_date: date = Query(..., alias="date"),
    user_id: str = Depends(require_user_id),
):
    return await load_timeline_notes(target_date, user_id)