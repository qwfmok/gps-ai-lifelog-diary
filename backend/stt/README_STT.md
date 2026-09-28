## 다른 프로젝트에 통합

`backend/stt/` 폴더만 복사하고 그 안의 `requirements-stt.txt`를 설치하면 됩니다. 복사한 `stt/`의 상위 디렉터리에서 `python -m stt.stt_cli`로 실행할 수 있습니다.

서비스 함수는 `backend.stt.stt_services`에서 import합니다. 폴더만 복사했다면 `stt.stt_services`에서 import합니다.

- `transcribe(queue, sample_rate, language, on_transcript, *, api_key, model=STT_MODEL)`: 큐에 24 kHz mono PCM16 little-endian 바이트를 실시간 속도로 넣고, 종료 시 `None`을 넣습니다. `async def callback(final_text, interim_text)` 콜백으로 진행 상황을 받으며, 함수 반환값은 확정 원문입니다. 함수가 WebSocket 연결과 종료를 관리합니다.
- `correct_text(text, prompt, *, model, api_key)`: 완성된 원문을 사용자 프롬프트로 교정하고 문자열을 반환합니다.

`await transcribe(...)` 완료 후 `await correct_text(...)`를 호출합니다. 두 함수는 마이크 장치나 파일 저장에 의존하지 않습니다. 서버에 통합할 때는 사용자의 장치에서 캡처한 PCM을 전달하고, 호출자가 입력 시간과 큐 크기를 제한해야 합니다.

## 동작과 제한

- 기존과 같이 CLI 녹음은 한 번에 최대 **4분**입니다. 이는 프로그램의 설정값입니다.
- 오디오는 100 ms 단위로 전송하고, 약 15초마다 전사 구간을 확정합니다. 임시 텍스트는 그 사이에도 출력됩니다.
- 최종 전사 이벤트가 역순으로 도착해도 오디오 구간 순서로 합칩니다.
- Enter는 정상 종료와 교정을 수행합니다. Ctrl+C는 취소하며 자동 교정하지 않습니다.
- 확정된 원문은 인식 도중에도 파일에 저장합니다. 연결이나 교정 실패 시 저장된 원문을 다시 사용할 수 있습니다.
- 연결 오류 후 자동 재연결하지 않습니다. 종료 시 최종 전사 대기 시간은 20초입니다.
- 음성, 교정 프롬프트, 원문은 OpenAI로 전송됩니다. 로컬 음성 파일은 저장하지 않습니다.