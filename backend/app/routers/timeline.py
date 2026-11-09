from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.auth import require_user_id
from app.routers.stay_points import build_daily_stays
from app.schemas.stay_point import StayPointResponse


router = APIRouter(prefix="/api/timeline", tags=["timeline"])


class TimelineItemResponse(StayPointResponse):
    id: str


@router.get("", response_model=list[TimelineItemResponse])
async def get_timeline(
    target_date: date = Query(..., alias="date"),
    user_id: str = Depends(require_user_id),
):
    stays = await build_daily_stays(target_date, user_id)
    return [{**stay, "id": stay["anchor_location_id"]} for stay in stays]