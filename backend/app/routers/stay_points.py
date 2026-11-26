from asyncio import to_thread
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.schemas.stay_point import StayPointResponse
from app.services.place_inference import enrich_stays_with_places
from app.services.stay_points import detect_stay_points


router = APIRouter(prefix="/api/stay-points", tags=["stay-points"])

KST = timezone(timedelta(hours=9))


async def build_daily_stays(
    target_date: date, user_id: str, *, include_place_candidates: bool = False
):
    start = datetime.combine(target_date, time.min, tzinfo=KST)
    end = start + timedelta(days=1)

    start_utc = start.astimezone(timezone.utc).isoformat()
    end_utc = end.astimezone(timezone.utc).isoformat()

    locations = []
    page_size = 500
    offset = 0

    while True:
        query = (
            supabase
            .table("location_logs")
            .select("id,latitude,longitude,recorded_at")
            .eq("user_id", user_id)
            .gte("recorded_at", start_utc)
            .lt("recorded_at", end_utc)
            .order("recorded_at")
            .order("id")
            .range(offset, offset + page_size - 1)
        )

        result = await to_thread(query.execute)
        page = result.data
        locations.extend(page)

        if len(page) < page_size:
            break

        offset += page_size

    stays = detect_stay_points(locations)

    visits = []
    offset = 0
    while True:
        visit_query = (
            supabase
            .table("imported_visits")
            .select("id,latitude,longitude,source_place_name,started_at,ended_at")
            .eq("user_id", user_id)
            .gte("started_at", start_utc)
            .lt("started_at", end_utc)
            .order("started_at")
            .order("id")
            .range(offset, offset + page_size - 1)
        )
        page = (await to_thread(visit_query.execute)).data
        visits.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    stays.extend({
        "anchor_location_id": visit["id"],
        "latitude": visit["latitude"],
        "longitude": visit["longitude"],
        "started_at": visit["started_at"],
        "ended_at": visit["ended_at"],
        "duration_minutes": (
            datetime.fromisoformat(visit["ended_at"].replace("Z", "+00:00"))
            - datetime.fromisoformat(visit["started_at"].replace("Z", "+00:00"))
        ).total_seconds() / 60,
        "point_count": 0,
        "place_name": visit["source_place_name"],
    } for visit in visits)
    stays.sort(key=lambda stay: (
        datetime.fromisoformat(stay["started_at"].replace("Z", "+00:00"))
        if isinstance(stay["started_at"], str)
        else stay["started_at"]
    ))

    return await enrich_stays_with_places(stays, include_place_candidates=include_place_candidates)


@router.get("", response_model=list[StayPointResponse])
async def get_stay_points(
    target_date: date = Query(..., alias="date"),
    user_id: str = Depends(require_user_id),
):
    return await build_daily_stays(target_date, user_id)
