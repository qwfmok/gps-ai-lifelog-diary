from pydantic import BaseModel
from uuid import UUID


class DiaryGenerateRequest(BaseModel):
    location_ids: list[UUID]
    memo: str


class DiaryGenerateResponse(BaseModel):
    generated_diary: str
    used_facts: list[str]
    uncertain_points: list[str]