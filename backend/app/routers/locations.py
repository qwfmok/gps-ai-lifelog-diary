from fastapi import APIRouter
from uuid import uuid4

from app.schemas.location import LocationCreate, LocationResponse


router = APIRouter(
    prefix="/api/locations",
    tags=["locations"]
)


@router.post("", response_model=LocationResponse)
async def create_location(location: LocationCreate):
    return LocationResponse(
        id=uuid4(),
        latitude=location.latitude,
        longitude=location.longitude,
        accuracy=location.accuracy,
        recorded_at=location.recorded_at,
        address=None
    )