from openai import AsyncOpenAI
from pathlib import Path


def load_context_instructions() -> str:
    prompt = Path(__file__).with_name("diary_context_prompt.txt")
    return prompt.read_text(encoding="utf-8-sig").strip() + """

    이 API에서는 JSON으로 날짜(date), 체류 기록(stays), 저장 메모(notes),
    요청 메모(memo), 음성 전사문(transcript)을 받는다. 빈 항목은 무시한다.

    체류 기록에서는 장소와 관측된 체류 시간만 서술한다.
    장소나 체류 시간만으로 방문 목적, 행동, 감정, 동행인을 추측하지 않는다.
    근거가 없다면 “짧은 용무를 본 것 같다”처럼 완곡하게도 추측하지 않는다.
    체류 장소에서 프로젝트 활동을 했다는 연결은 입력에 명시된 경우에만 서술한다.
    “체류지 메모 저장 테스트”는 기능 확인용 문구이므로 본문에서 생략한다.
    단, 사용자가 실제로 위치 조회 기능을 테스트했다는 기록은 반영한다.
    위 규칙이 앞의 지침과 충돌하면 위 규칙을 우선한다.
    체류 기록과 메모·전사문에 나온 활동은 서로 연결된 근거가 없으면 별도 문장으로 쓴다.
    “그곳에서”, “그 과정에서” 같은 표현으로 활동과 체류 장소를 연결하지 않는다.
    활동의 시각이나 순서가 명시되지 않았다면 “하루를 시작했다”, “이후에” 같은 표현을 쓰지 않는다.
    duration_minutes가 있으면 수치와 단위를 본문에 그대로 쓴다. 예: 15분간 머물렀다.
    """

async def generate_diary_draft(
    memo: str, *, api_key: str, model: str, use_context: bool = False ) -> str:
    async with AsyncOpenAI(
        api_key=api_key,
        timeout=30.0,
        max_retries=0,
    ) as client:
        response = await client.responses.create(
            model=model,
                        instructions=(
                load_context_instructions()
                if use_context
                else (
                    "사용자 메모를 바탕으로 짧은 한국어 1인칭 일기 초안을 작성하세요. "
                    "메모에 없는 사건, 장소, 인물, 감정은 덧붙이지 마세요. "
                    "일기 본문만 반환하세요."
                )
            ),
            input=memo,
            max_output_tokens=1200,
            store=False,
        )

    draft = response.output_text.strip()
    if response.status != "completed" or not draft:
        raise ValueError("완성된 초안이 없습니다.")
    return draft