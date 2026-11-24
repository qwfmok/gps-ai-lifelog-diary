from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class DiaryGenerateRequest(BaseModel):
    location_ids: list[UUID] = Field(default_factory=list)
    memo: str = ""
    diary_date: date | None = None
    transcript: str | None = Field(default=None, max_length=12000)


class DiaryGenerateResponse(BaseModel):
    generated_diary: str
    used_facts: list[str]
    uncertain_points: list[str]