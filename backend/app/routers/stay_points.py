from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Query

from app.db.supabase import supabase
from app.services.stay_points import detect_stay_points


router = APIRouter(
    prefix="/api/stay-points",
    tags=["stay-points"],
)

KST = timezone(timedelta(hours=9))


@router.get("")
def get_stay_points(
    target_date: date = Query(..., alias="date"),
):
    start = datetime.combine(target_date, time.min, tzinfo=KST)
    end = start + timedelta(days=1)

    start_utc = start.astimezone(timezone.utc).isoformat()
    end_utc = end.astimezone(timezone.utc).isoformat()

    # Supabase의 응답 건수 제한에 대비해 나눠서 조회합니다.
    locations = []
    page_size = 500
    offset = 0

    while True:
        result = (
            supabase
            .table("location_logs")
            .select("id,latitude,longitude,recorded_at")
            .gte("recorded_at", start_utc)
            .lt("recorded_at", end_utc)
            .order("recorded_at")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        page = result.data
        locations.extend(page)

        if len(page) < page_size:
            break

        offset += page_size

    return detect_stay_points(locations)