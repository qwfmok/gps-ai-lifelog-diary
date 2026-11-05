from datetime import datetime

from pydantic import BaseModel


class StayPointResponse(BaseModel):
    latitude: float
    longitude: float
    started_at: datetime
    ended_at: datetime
    duration_minutes: float
    point_count: int
    address: str | None = None