from asyncio import to_thread
from datetime import date, datetime, time, timedelta, timezone
import logging

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.schemas.location import LocationCreate, LocationResponse
from app.schemas.stay_point import StayPointResponse
from app.services.geocoding import reverse_geocode
from app.services.location_import import parse_location_file
from app.services.place_inference import infer_place_and_activity
from app.services.stay_points import detect_stay_points


router = APIRouter(
    prefix="/api/locations",
    tags=["locations"],
)

KST = timezone(timedelta(hours=9))
logger = logging.getLogger(__name__)


class LocationImportResponse(BaseModel):
    imported_count: int
    stays: list[StayPointResponse]


@router.post("/import", response_model=LocationImportResponse)
async def import_locations(
    file: UploadFile = File(...),
    user_id: str = Depends(require_user_id),
):
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="파일은 10 MiB 이하여야 합니다.")
    try:
        points = parse_location_file(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    data = [
        {
            "user_id": user_id,
            "latitude": point.latitude,
            "longitude": point.longitude,
            "accuracy": point.accuracy,
            "recorded_at": point.recorded_at.astimezone(timezone.utc).isoformat(),
            "address": None,
        }
        for point in points
    ]
    for offset in range(0, len(data), 500):
        query = supabase.table("location_logs").insert(data[offset:offset + 500])
        await to_thread(query.execute)

    stays = detect_stay_points(data)
    for stay in stays:
        stay["address"] = None
        try:
            stay["address"] = await reverse_geocode(
                latitude=stay["latitude"], longitude=stay["longitude"]
            )
        except httpx.HTTPError as exc:
            logger.warning("Imported stay address lookup failed: %s", type(exc).__name__)
        guesses = infer_place_and_activity(stay["address"])
        stay["place_category"] = guesses[0].category if guesses else None
        stay["activity_candidates"] = [
            {
                "name": guess.activity,
                "confidence": guess.confidence,
                "source": "place_name_heuristic",
            }
            for guess in guesses
        ]

    return {"imported_count": len(points), "stays": stays}


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
