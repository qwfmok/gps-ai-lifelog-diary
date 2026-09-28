from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: float | None = None
    recorded_at: datetime


class LocationResponse(LocationCreate):
    id: UUID
    address: str | None = None