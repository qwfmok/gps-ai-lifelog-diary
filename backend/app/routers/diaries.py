from fastapi import APIRouter

from app.schemas.diary import (
    DiaryGenerateRequest,
    DiaryGenerateResponse,
)


router = APIRouter(
    prefix="/api/diaries",
    tags=["diaries"],
)


@router.post(
    "/generate",
    response_model=DiaryGenerateResponse
)
async def generate_diary(data: DiaryGenerateRequest):
    return DiaryGenerateResponse(
        generated_diary=(
            "오늘은 친구와 카페에서 프로젝트에 관해 이야기를 나눴다."
        ),
        used_facts=[
            "카페에서 프로젝트 회의를 함"
        ],
        uncertain_points=[]
    )