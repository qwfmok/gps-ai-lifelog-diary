from asyncio import to_thread
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.core.auth import require_user_id
from app.db.supabase import supabase
from app.schemas.location import LocationCreate, LocationResponse
from app.schemas.stay_point import StayPointResponse
from app.services.geocoding import reverse_geocode
from app.services.location_import import parse_location_file
from app.services.place_inference import enrich_stays_with_places
from app.services.stay_points import detect_stay_points


router = APIRouter(
    prefix="/api/locations",
    tags=["locations"],
)

KST = timezone(timedelta(hours=9))


class LocationImportResponse(BaseModel):
    imported_count: int
    visit_count: int
    stays: list[StayPointResponse]


@router.post("/import", response_model=LocationImportResponse)
async def import_locations(
    file: UploadFile = File(...),
    user_id: str = Depends(require_user_id),
):
    content = await file.read(10 * 1024 * 1024 + 1)
    try:
        imported = parse_location_file(file.filename or "", content)
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
        for point in imported.points
    ]
    for offset in range(0, len(data), 500):
        query = supabase.table("location_logs").insert(data[offset:offset + 500])
        await to_thread(query.execute)

    visits_data = [
        {
            "user_id": user_id,
            "latitude": visit.latitude,
            "longitude": visit.longitude,
            "source_place_name": visit.source_place_name,
            "started_at": visit.started_at.astimezone(timezone.utc).isoformat(),
            "ended_at": visit.ended_at.astimezone(timezone.utc).isoformat(),
        }
        for visit in imported.visits
    ]
    for offset in range(0, len(visits_data), 500):
        query = supabase.table("imported_visits").upsert(
            visits_data[offset:offset + 500],
            on_conflict="user_id,latitude,longitude,started_at,ended_at",
        )
        await to_thread(query.execute)

    stays = detect_stay_points(data)
    stays.extend({
        "latitude": visit.latitude,
        "longitude": visit.longitude,
        "started_at": visit.started_at,
        "ended_at": visit.ended_at,
        "duration_minutes": (visit.ended_at - visit.started_at).total_seconds() / 60,
        "point_count": 0,
        "place_name": visit.source_place_name,
    } for visit in imported.visits)
    stays.sort(key=lambda stay: (
        datetime.fromisoformat(stay["started_at"].replace("Z", "+00:00"))
        if isinstance(stay["started_at"], str)
        else stay["started_at"]
    ))
    await enrich_stays_with_places(stays)

    return {
        "imported_count": len(imported.points),
        "visit_count": len(stays),
        "stays": stays,
    }


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
