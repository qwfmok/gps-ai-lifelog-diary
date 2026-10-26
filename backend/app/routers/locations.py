from fastapi import APIRouter

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