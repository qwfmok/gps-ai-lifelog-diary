"""Generate a diary from a day's visits and an STT transcript."""

import argparse
from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys

import httpx
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError
from pydantic import TypeAdapter, ValidationError

from ..app.schemas.stay_point import StayPointResponse

DIARY_DIR = Path(__file__).resolve().parent
KST = timezone(timedelta(hours=9))
Timeline = list[dict[str, str | float | None]]


def read_timeline() -> Timeline:
    print("장소와 시간을 한 건씩 입력하세요. 장소에서 빈 Enter를 누르면 입력을 마칩니다.")
    timeline: Timeline = []
    while place := input(f"{len(timeline) + 1}번째 장소: ").strip():
        while True:
            entered_time = input("시간 (24시간제 HH:MM): ").strip()
            try:
                visit_time = datetime.strptime(entered_time, "%H:%M").strftime("%H:%M")
            except ValueError:
                print("시간을 24시간제 시:분 형식으로 입력해 주세요. 예: 09:30")
            else:
                break
        timeline.append({"time": visit_time, "place": place})
    if not timeline:
        raise ValueError("장소와 시간을 한 건 이상 입력해 주세요.")
    return sorted(timeline, key=lambda visit: str(visit["time"]))


def fetch_timeline(base_url: str, day: date) -> Timeline:
    url = f"{base_url.rstrip('/')}/api/stay-points"
    try:
        response = httpx.get(url, params={"date": day.isoformat()}, timeout=30)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"백엔드 체류지 조회에 실패했습니다 (HTTP {exc.response.status_code}).") from exc
    except (httpx.RequestError, httpx.InvalidURL) as exc:
        raise RuntimeError("백엔드 체류지 API에 연결할 수 없습니다. 서버 상태와 --backend-url을 확인해 주세요.") from exc

    try:
        stays = TypeAdapter(list[StayPointResponse]).validate_json(response.content)
    except ValidationError as exc:
        raise RuntimeError("백엔드의 체류지 응답 형식이 올바르지 않습니다.") from exc
    if not stays:
        raise RuntimeError(f"{day}에 감지된 체류지가 없습니다. 직접 입력하려면 --date 없이 실행해 주세요.")

    for stay in stays:
        if stay.started_at.utcoffset() is None or stay.ended_at.utcoffset() is None:
            raise RuntimeError("백엔드 체류지의 시각에 시간대 정보가 없습니다.")
    stays.sort(key=lambda stay: stay.started_at)
    return [
        {
            "address": stay.address,
            "started_at": stay.started_at.astimezone(KST).isoformat(),
            "ended_at": stay.ended_at.astimezone(KST).isoformat(),
            "duration_minutes": stay.duration_minutes,
        }
        for stay in stays
    ]


def read_transcript(path: Path | None) -> str:
    if path is not None:
        transcript = path.read_text(encoding="utf-8-sig")
    else:
        print("STT 전사문을 붙여넣고, 마지막에 별도 줄로 END를 입력하세요.")
        lines = []
        while (line := input()) != "END":
            lines.append(line)
        transcript = "\n".join(lines)
    if not transcript.strip():
        raise ValueError("STT 전사문을 입력해 주세요.")
    return transcript


def generate_diary(
    timeline: Timeline,
    transcript: str,
    prompt: str,
    *,
    model: str,
    api_key: str,
) -> str:
    diary_input = json.dumps({"timeline": timeline, "stt_text": transcript}, ensure_ascii=False)
    with OpenAI(api_key=api_key, timeout=90, max_retries=0) as client:
        response = client.responses.create(
            model=model, instructions=prompt, input=diary_input, store=False,
        )
    if response.status != "completed" or not response.output_text.strip():
        raise RuntimeError("OpenAI가 완성된 일기 본문을 반환하지 않았습니다.")
    return response.output_text.strip()


def main() -> int:
    load_dotenv(DIARY_DIR.parent / ".env")
    load_dotenv(DIARY_DIR.parent.parent / ".env")
    parser = argparse.ArgumentParser(description="장소·시간 기록과 STT 전사문으로 일기를 생성합니다.")
    parser.add_argument("--date", type=date.fromisoformat, metavar="YYYY-MM-DD", help="백엔드에서 체류지를 조회할 날짜")
    parser.add_argument("--backend-url", default="http://localhost:8000", help="백엔드 주소 (기본값 http://localhost:8000)")
    parser.add_argument(
        "--prompt-file", type=Path, default=DIARY_DIR / "prompt.txt", help="일기 작성 프롬프트 TXT 파일",
    )
    parser.add_argument("--stt-file", type=Path, help="기존 STT 전사문 TXT 파일")
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL") or "gpt-4.1-mini", help="일기 생성 모델")
    parser.add_argument("--output-dir", type=Path, default=DIARY_DIR / "output", help="일기 저장 폴더")
    args = parser.parse_args()

    try:
        prompt = args.prompt_file.read_bytes().decode("utf-8-sig")
        if not prompt.strip():
            raise ValueError(f"{args.prompt_file}에 일기 작성 프롬프트를 입력해 주세요.")
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("backend/.env 또는 환경 변수에 OPENAI_API_KEY를 설정해 주세요.")

        if args.date is not None:
            print(f"{args.date} 체류지를 백엔드에서 조회하고 있습니다…", flush=True)
            timeline = fetch_timeline(args.backend_url, args.date)
        else:
            timeline = read_timeline()
        transcript = read_transcript(args.stt_file)
        print("\n일기를 생성하고 있습니다…", flush=True)
        diary = generate_diary(timeline, transcript, prompt, model=args.model, api_key=api_key)
        print(f"\n[생성된 일기]\n{diary}")

        args.output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        output_path = args.output_dir / f"{timestamp}.diary.txt"
        output_path.write_text(diary + "\n", encoding="utf-8")
        print(f"\n일기 저장 위치: {output_path}")
        return 0
    except (KeyboardInterrupt, EOFError):
        print("\n입력을 취소했습니다.", file=sys.stderr)
        return 130
    except OpenAIError as exc:
        print(
            f"\nOpenAI 요청 실패 ({type(exc).__name__}). API 키, 모델 접근 권한, 네트워크를 확인해 주세요.",
            file=sys.stderr,
        )
        return 1
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"\n실행 실패: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
