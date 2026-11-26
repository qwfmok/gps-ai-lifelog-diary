from datetime import datetime

from pydantic import BaseModel, Field


class ActivityCandidate(BaseModel):
    name: str
    confidence: float = Field(ge=0, le=1)
    source: str


class StayPointResponse(BaseModel):
    latitude: float
    longitude: float
    started_at: datetime
    ended_at: datetime
    duration_minutes: float
    point_count: int
    address: str | None = None
    place_name: str | None = None
    place_category: str | None = None
    place_category_code: str | None = None
    place_distance_meters: int | None = None
    activity_candidates: list[ActivityCandidate] = Field(default_factory=list)
