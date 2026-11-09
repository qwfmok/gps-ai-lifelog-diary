from openai import AsyncOpenAI


async def generate_diary_draft(memo: str, *, api_key: str, model: str) -> str:
    async with AsyncOpenAI(
        api_key=api_key,
        timeout=30.0,
        max_retries=0,
    ) as client:
        response = await client.responses.create(
            model=model,
            instructions=(
                "사용자 메모를 바탕으로 짧은 한국어 1인칭 일기 초안을 작성하세요. "
                "메모에 없는 사건, 장소, 인물, 감정은 덧붙이지 마세요. "
                "일기 본문만 반환하세요."
            ),
            input=memo,
            max_output_tokens=1200,
            store=False,
        )

    draft = response.output_text.strip()
    if response.status != "completed" or not draft:
        raise ValueError("완성된 초안이 없습니다.")
    return draft