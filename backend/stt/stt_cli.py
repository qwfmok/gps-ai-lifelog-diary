"""Run with: python -m backend.stt.stt_cli --prompt-file backend/stt/prompt.txt"""
import argparse
import asyncio
from datetime import datetime
import os
from pathlib import Path
import sys

from dotenv import load_dotenv
import sounddevice as sd

from .stt_services import MAX_SECONDS, SAMPLE_RATE, STT_MODEL, correct_text, transcribe

STT_DIR = Path(__file__).resolve().parent


async def wait_for_enter():
    """Poll stdin without leaving a blocked input thread on API failure."""
    if os.name == "nt":
        import msvcrt
        while True:
            if msvcrt.kbhit():
                key = msvcrt.getwch()
                if key in ("\r", "\n"):
                    return
                if key == "\x03":
                    raise KeyboardInterrupt
            await asyncio.sleep(0.05)
    else:
        import select
        while not select.select([sys.stdin], [], [], 0)[0]:
            await asyncio.sleep(0.05)
        sys.stdin.readline()


async def record(args, on_transcript):
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue(maxsize=100)
    audio_error = loop.create_future()
    accepting = True

    def enqueue(data, error):
        if not accepting or audio_error.done():
            return
        if error:
            audio_error.set_result(RuntimeError(f"마이크 입력 오류: {error}"))
        else:
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                audio_error.set_result(RuntimeError("음성 전송이 지연되어 녹음을 중단했습니다."))

    def callback(indata, frames, time_info, status):
        loop.call_soon_threadsafe(enqueue, bytes(indata), str(status) if status else "")

    recognizer = asyncio.create_task(transcribe(
        queue, SAMPLE_RATE, args.language, on_transcript,
        api_key=os.getenv("OPENAI_API_KEY"), model=args.stt_model,
    ))
    stop = asyncio.create_task(wait_for_enter())
    try:
        with sd.RawInputStream(samplerate=SAMPLE_RATE, blocksize=SAMPLE_RATE // 10,
                               device=args.device, channels=1, dtype="int16", callback=callback):
            print(f"\n녹음 중… Enter로 종료합니다. 최대 {MAX_SECONDS // 60}분 후 자동 종료됩니다.")
            done, _ = await asyncio.wait([recognizer, stop, audio_error], timeout=MAX_SECONDS,
                                         return_when=asyncio.FIRST_COMPLETED)
            if audio_error in done:
                raise audio_error.result()
            if recognizer in done:
                await recognizer
                raise RuntimeError("녹음 종료 전에 OpenAI STT 연결이 끊겼습니다.")
            if stop in done:
                await stop
        # Drain callbacks already scheduled by the PortAudio thread before EOF.
        await asyncio.sleep(0)
        accepting = False
        if audio_error.done():
            raise audio_error.result()
        print("\n최종 음성 인식 결과를 기다리고 있습니다…")
        await asyncio.wait_for(queue.put(None), timeout=5)
        return await asyncio.wait_for(recognizer, timeout=30)
    finally:
        accepting = False
        stop.cancel()
        recognizer.cancel()
        audio_error.cancel()
        await asyncio.gather(stop, recognizer, return_exceptions=True)


async def run(args, prompt):
    args.output_dir.mkdir(parents=True, exist_ok=True)
    prefix = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    raw_path = args.output_dir / f"{prefix}.raw.txt"
    corrected_path = args.output_dir / f"{prefix}.corrected.txt"
    last_final = ""

    async def show(final_text, interim_text):
        nonlocal last_final
        if final_text != last_final:
            print(f"\r{' ' * 90}\r[확정] {final_text}", flush=True)
            last_final = final_text
            raw_path.write_text(final_text, encoding="utf-8")
        if interim_text:
            print(f"\r[인식 중] {interim_text[-60:]:<60}", end="", flush=True)

    if args.text_file:
        text = args.text_file.read_text(encoding="utf-8-sig")
    else:
        text = await record(args, show)
    if not text.strip():
        print("\n인식된 음성이 없어 교정을 실행하지 않았습니다.")
        return
    raw_path.write_text(text, encoding="utf-8")
    print(f"\n원문 저장: {raw_path}\nGPT 교정 중…")
    corrected = await correct_text(text, prompt, model=args.model, api_key=os.getenv("OPENAI_API_KEY"))
    corrected_path.write_text(corrected, encoding="utf-8")
    print(f"\n[교정 결과]\n{corrected}\n\n교정문 저장: {corrected_path}")


def main():
    load_dotenv(STT_DIR / ".env")
    load_dotenv()  # Also support a .env in an ancestor project directory.
    parser = argparse.ArgumentParser(description="OpenAI 실시간 받아쓰기 → 입력 종료 → GPT 교정")
    parser.add_argument("--prompt-file", type=Path, help="직접 작성한 UTF-8 교정 프롬프트 파일")
    parser.add_argument("--text-file", type=Path, help="녹음 대신 기존 원문 파일을 교정 (재시도용)")
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL") or "gpt-4.1-mini")
    parser.add_argument("--stt-model", default=os.getenv("OPENAI_STT_MODEL") or STT_MODEL)
    parser.add_argument("--language", default="ko", help="인식 언어 코드 (ko, en 등)")
    parser.add_argument("--device", type=int, help="입력 마이크 번호")
    parser.add_argument("--list-devices", action="store_true")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent / "output")
    args = parser.parse_args()
    try:
        if args.list_devices:
            print(sd.query_devices())
            return 0
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError(".env 또는 환경 변수에 OPENAI_API_KEY를 설정해 주세요.")
        if args.prompt_file:
            prompt = args.prompt_file.read_text(encoding="utf-8-sig")
        else:
            print("교정 프롬프트를 입력하세요. 마지막에 별도 줄로 END를 입력하세요.")
            lines = []
            while (line := input()) != "END":
                lines.append(line)
            prompt = "\n".join(lines)
        if not prompt.strip():
            raise ValueError("교정 프롬프트가 비어 있습니다.")
        asyncio.run(run(args, prompt))
        return 0
    except (KeyboardInterrupt, EOFError):
        print("\n취소했습니다. 이미 저장된 원문은 유지됩니다.")
        return 130
    except Exception as exc:
        detail = str(exc) if isinstance(exc, (ValueError, RuntimeError, OSError)) else "API 인증·사용 한도·네트워크·마이크 설정을 확인해 주세요."
        print(f"\n실행 실패 ({type(exc).__name__}): {detail}\n저장된 원문은 출력 폴더에서 확인할 수 있습니다.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
