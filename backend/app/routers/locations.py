from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Query

from app.schemas.location import (
    LocationCreate,
    LocationResponse,
)
from app.db.supabase import supabase
from app.services.geocoding import reverse_geocode


router = APIRouter(
    prefix="/api/locations",
    tags=["locations"],
)


@router.post("", response_model=LocationResponse)
async def create_location(location: LocationCreate):

    address = await reverse_geocode(
        latitude=location.latitude,
        longitude=location.longitude,
    )

    print("Parsed address:", address)

    data = {
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "recorded_at": location.recorded_at.isoformat(),
        "address": address,
    }

    result = (
        supabase
        .table("location_logs")
        .insert(data)
        .execute()
    )

    saved_location = result.data[0]

    return saved_location

KST = timezone(timedelta(hours=9))


@router.get("", response_model=list[LocationResponse])
def get_locations(
    target_date: date = Query(..., alias="date"),
):
    start = datetime.combine(target_date, time.min, tzinfo=KST)
    end = start + timedelta(days=1)

    result = (
        supabase
        .table("location_logs")
        .select("*")
        .gte("recorded_at", start.astimezone(timezone.utc).isoformat())
        .lt("recorded_at", end.astimezone(timezone.utc).isoformat())
        .order("recorded_at")
        .execute()
    )

    return result.data