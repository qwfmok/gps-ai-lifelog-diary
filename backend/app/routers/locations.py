from asyncio import to_thread
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.schemas.location import LocationCreate, LocationResponse
from app.services.geocoding import reverse_geocode


router = APIRouter(
    prefix="/api/locations",
    tags=["locations"],
)

KST = timezone(timedelta(hours=9))


@router.post("", response_model=LocationResponse)
async def create_location(
    location: LocationCreate,
    user_id: str = Depends(require_user_id),
):
    address = await reverse_geocode(
        latitude=location.latitude,
        longitude=location.longitude,
    )

    data = {
        "user_id": user_id,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "recorded_at": location.recorded_at.isoformat(),
        "address": address,
    }

    query = supabase.table("location_logs").insert(data)
    result = await to_thread(query.execute)

    return result.data[0]


@router.get("", response_model=list[LocationResponse])
def get_locations(
    target_date: date = Query(..., alias="date"),
    user_id: str = Depends(require_user_id),
):
    start = datetime.combine(target_date, time.min, tzinfo=KST)
    end = start + timedelta(days=1)

    result = (
        supabase
        .table("location_logs")
        .select("*")
        .eq("user_id", user_id)
        .gte("recorded_at", start.astimezone(timezone.utc).isoformat())
        .lt("recorded_at", end.astimezone(timezone.utc).isoformat())
        .order("recorded_at")
        .execute()
    )

    return result.data