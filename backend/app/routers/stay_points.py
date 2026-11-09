import logging
from asyncio import to_thread
from datetime import date, datetime, time, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Query

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.schemas.stay_point import StayPointResponse
from app.services.geocoding import reverse_geocode
from app.services.stay_points import detect_stay_points


router = APIRouter(prefix="/api/stay-points", tags=["stay-points"])

KST = timezone(timedelta(hours=9))
logger = logging.getLogger(__name__)


async def build_daily_stays(target_date: date, user_id: str):
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

    for stay in stays:
        stay["address"] = None
        try:
            stay["address"] = await reverse_geocode(
                latitude=stay["latitude"],
                longitude=stay["longitude"],
            )
        except httpx.HTTPError as exc:
            logger.warning(
                "Stay point address lookup failed: %s",
                type(exc).__name__,
            )

    return stays


@router.get("", response_model=list[StayPointResponse])
async def get_stay_points(
    target_date: date = Query(..., alias="date"),
    user_id: str = Depends(require_user_id),
):
    return await build_daily_stays(target_date, user_id)