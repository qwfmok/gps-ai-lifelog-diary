import asyncio
import io
import wave

from stt.stt_services import MAX_SECONDS, SAMPLE_RATE, transcribe


class InvalidWav(ValueError):
    pass


def read_pcm(data: bytes) -> bytes:
    try:
        with wave.open(io.BytesIO(data), "rb") as audio:
            if (
                audio.getframerate() != SAMPLE_RATE
                or audio.getnchannels() != 1
                or audio.getsampwidth() != 2
                or audio.getcomptype() != "NONE"
            ):
                raise InvalidWav("24 kHz 모노 PCM16 WAV 파일을 올려주세요.")

            frame_count = audio.getnframes()
            if not 0 < frame_count <= SAMPLE_RATE * MAX_SECONDS:
                raise InvalidWav("음성은 비어 있지 않고 4분 이하여야 합니다.")

            pcm = audio.readframes(frame_count)
            if len(pcm) != frame_count * 2:
                raise InvalidWav("WAV 오디오 데이터가 잘렸습니다.")
            return pcm
    except (wave.Error, EOFError) as exc:
        raise InvalidWav("올바른 PCM WAV 파일을 올려주세요.") from exc


async def transcribe_wav(data: bytes, *, api_key: str) -> str:
    pcm = read_pcm(data)
    queue = asyncio.Queue(maxsize=2)
    queue.put_nowait(pcm)
    queue.put_nowait(None)

    async def ignore_progress(_final: str, _interim: str) -> None:
        pass

    return await asyncio.wait_for(
        transcribe(queue, SAMPLE_RATE, "ko", ignore_progress, api_key=api_key),
        timeout=MAX_SECONDS + 30,
    )
