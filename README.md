# GPS 기반 행동 추론 및 LLM 기반 자동 라이프로그 일기장

스마트폰의 위치·시간 기록을 기억의 단서로 만들고, 사용자가 음성이나 텍스트로 부족한 맥락을 보완하면 LLM이 하루 일기를 생성하는 융합캡스톤디자인 프로젝트입니다.

## 프로젝트 목표

- 연속 GPS 로그에서 체류 구간을 탐지합니다.
- 체류 위치를 주소·장소 후보로 변환합니다.
- 장소, 시간, 체류시간을 이용해 행동 후보를 생성합니다.
- 불확실한 행동은 사용자 확인으로 보완합니다.
- 확인된 사실과 음성 기록만 이용해 일기를 생성합니다.

## MVP 범위

1. 위치·시간 수집 및 저장
2. 일기 작성·조회·수정·삭제
3. 위치·메모 기반 LLM 일기 생성
4. 음성 입력 및 STT
5. 체류지 탐지와 장소·행동 후보 생성

장기 감정 분석, 벡터 검색, 캘린더·헬스케어 연동은 선택 기능으로 둡니다.

## 시스템 구조

```text
Frontend / PWA
  └─ Geolocation API, 위치·음성·일기 화면
            ↓
FastAPI Backend
  ├─ 위치 로그 검증 및 저장
  ├─ 체류지 탐지
  ├─ Google Maps Platform 연동
  └─ 행동 후보·일기 생성 API
            ↓
Supabase PostgreSQL
  ├─ location_logs
  ├─ stay_points
  ├─ activities
  ├─ voice_records
  └─ diaries
```

## 일정

- 10월 12일 중간발표: 위치·메모 수집, LLM 일기 생성, 일기 CRUD 시연
- 10월 중순~11월: STT, 체류지 탐지, 장소·행동 후보 및 사용자 확인 구현
- 11월 말: 통합 테스트, 비교 평가, 발표자료와 시연 영상 확정
- 12월 초 최종발표

자세한 일정은 [docs/ROADMAP.md](docs/ROADMAP.md)를 참고하세요.

## 역할

- 김시연: 프로젝트 총괄, 프론트엔드 UI/UX, 모바일 GPS 수집
- 박정우: FastAPI, Supabase, Google Maps Platform, GPS·체류지 데이터 처리
- 정효림: STT·LLM, 프롬프트, 행동 추론 및 AI 분석

## 개발 원칙

- 위치만으로 행동을 확정하지 않고 후보와 근거를 제공합니다.
- 사용자가 확인한 정보와 시스템 추정값을 구분해 저장합니다.
- 원본 위치 데이터는 필요한 기간만 보관하고 요약 데이터로 변환합니다.
- API 키와 사용자 데이터는 저장소에 커밋하지 않습니다.

## 저장소 구조

```text
frontend/   웹·PWA 클라이언트
backend/    FastAPI 서버
supabase/   데이터베이스 스키마와 마이그레이션
docs/       설계, 일정, 평가 계획
```

## 시작하기

현재 저장소는 프로젝트 구조와 개발 계획을 정리한 초기 상태입니다. 첫 구현 목표는 실제 휴대폰에서 위치와 메모를 전송해 일기 한 편을 생성하고 저장하는 흐름입니다.

### 일기 생성 CLI

저장소 루트에서 `python -m pip install -r backend/diary/requirements-diary.txt`로 의존성을 설치합니다. `backend/.env`에 `OPENAI_API_KEY`를 설정하고 [일기 프롬프트](backend/diary/prompt.txt)를 준비합니다.

FastAPI 서버가 실행 중이면 날짜를 지정해 해당 날짜의 체류지로 일기를 생성할 수 있습니다.

```powershell
python -m backend.diary.diary_cli --date 2026-11-09
```

CLI는 `GET /api/stay-points`에서 체류지를 조회해 주소(`address`), 한국 시간으로 변환한 시작·종료 시각(`started_at`, `ended_at`), 체류 시간(분, `duration_minutes`)을 시작 시각순으로 전달합니다. 주소를 조회할 수 없는 체류지는 `address`가 `null`입니다. 서버 주소가 다르면 `--backend-url`로 지정할 수 있습니다.

`--date`를 생략하면 장소와 시간을 직접 입력할 수 있습니다. STT 전사문을 붙여넣고 마지막 줄에 `END`를 입력하거나 `--stt-file`로 TXT 파일을 지정합니다. 결과는 기본적으로 `backend/diary/output/`에 저장됩니다.

