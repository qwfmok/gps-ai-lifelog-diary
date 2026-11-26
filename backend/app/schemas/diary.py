from datetime import date
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.location import LocationCreate


class DiaryCurrentLocation(LocationCreate):
    accuracy: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    recorded_at: AwareDatetime


class DiaryGenerateRequest(BaseModel):
    location_ids: list[UUID] = Field(default_factory=list)
    memo: str = ""
    diary_date: date | None = None
    transcript: str | None = Field(default=None, max_length=12000)
    current_location: DiaryCurrentLocation | None = None


class DiaryGenerateResponse(BaseModel):
    generated_diary: str
    used_facts: list[str]
    uncertain_points: list[str]
