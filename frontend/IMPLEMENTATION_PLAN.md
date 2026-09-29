# IMPLEMENTATION_PLAN.md

## Development Strategy

전체 Frontend를 한 번에 구현하지 않는다.

작업을 작은 Phase로 나누고
각 Phase를 구현하고 검증한 후 다음 Phase로 진행한다.

사용자가 명시적으로 요청하지 않는 이상
Codex는 다음 Phase를 먼저 구현하지 않는다.


# Phase 0 - Project Initialization

목표:

Frontend 개발을 시작할 수 있는 기본 프로젝트 환경 구축.

작업:

- Frontend framework 초기화
- TypeScript 설정
- 기본 src 폴더
- 기본 routing 준비
- global style
- asset 구조
- 환경변수 구조
- lint
- build 환경

주의:

아직 실제 서비스 기능은 구현하지 않는다.

완료 조건:

- Development Server 실행 가능
- 기본 화면 출력
- Build 성공
- 치명적인 Error 없음


# Phase 1 - Application Shell

목표:

앱 전체의 기본적인 화면 골격 구축.

구현:

- App Layout
- Header
- Main Content
- Mobile Bottom Navigation
- Page Container
- Routing

초기 Page:

- Today
- History
- Settings

완료 조건:

- 세 Page 간 이동 가능
- Mobile UI 정상
- Desktop에서도 Layout이 깨지지 않음


# Phase 2 - Domain Types and Mock Architecture

목표:

향후 Backend 없이도 전체 Frontend를 개발할 수 있는 데이터 구조 구축.

구현:

- TypeScript Domain Types
- Mock Data
- Service Interfaces
- Mock Service

준비 대상:

- TimelineEvent
- Place
- Activity
- Diary
- VoiceRecord

Service:

- TimelineService
- LocationService
- ActivityService
- VoiceService
- DiaryService

완료 조건:

- Component 내부에 Mock 데이터 하드코딩 없음
- Service를 통해 데이터를 가져올 수 있음


# Phase 3 - Today Page and Timeline

목표:

서비스의 핵심인 하루 기록 화면 구현.

구현:

- Today Header
- Date
- Daily Status
- Timeline
- TimelineItem
- Time
- Place
- Activity
- Activity Status
- Confidence 표시 구조
- Empty Event

완료 조건:

- Mock Timeline을 시간순으로 확인 가능
- Timeline Event 상태별 UI가 구분됨


# Phase 4 - Activity Confirmation

목표:

불확실한 행동을 사용자가 보완할 수 있도록 한다.

구현:

- Uncertain Activity Card
- AI Question Mock UI
- 추천 행동
- 행동 선택
- 직접 입력
- Confirm
- Edit

완료 조건:

- UNCERTAIN Event 수정 가능
- 수정 결과 Timeline에 즉시 반영


# Phase 5 - Voice Recording UX

목표:

기억과 감정을 음성으로 추가하는 Frontend Flow 구현.

구현:

- Record Start
- Recording
- Recording Timer
- Stop
- Cancel
- Processing
- Mock STT
- STT Text Edit
- Retry

실제 STT API는 연결하지 않는다.

완료 조건:

- Voice Recording 전체 UI Flow가 동작
- Mock STT 결과 확인 가능


# Phase 6 - Diary Generation

목표:

Timeline과 사용자 보완 정보를 기반으로
일기 생성 Flow 구현.

구현:

- Generate Diary Button
- Validation
- Generating State
- Loading UI
- Mock Diary Generation
- Generated Diary View
- Error UI
- Retry

실제 LLM API는 연결하지 않는다.

완료 조건:

- 사용자 입력 → Diary 생성 UX 전체 수행 가능


# Phase 7 - Diary Editor

목표:

AI가 생성한 일기의 최종 통제권을 사용자에게 제공.

구현:

- Diary Editor
- Edit
- Save
- Cancel
- Delete
- Regenerate

완료 조건:

- 생성된 일기 수정 가능
- Mock 저장 가능


# Phase 8 - History

목표:

과거 일기 조회 기능 구현.

구현:

- History List
- Date
- Diary Preview
- Empty State
- Diary Detail Routing

완료 조건:

- Mock 과거 일기 확인 가능
- 일기 상세 화면 이동 가능


# Phase 9 - Diary Detail

구현:

- Date
- Diary Content
- Timeline Summary
- Place Summary
- Edit Entry Point

완료 조건:

- 저장된 일기 상세 내용 확인 가능


# Phase 10 - Settings and Privacy

목표:

위치 및 데이터 사용에 대한 사용자 통제 기능 제공.

구현:

- Location Tracking ON/OFF
- Permission Status
- Location History Delete
- Diary Delete 관련 UX
- Delete All Data
- Privacy Information

완료 조건:

- 주요 개인정보 제어 UI 사용 가능


# Phase 11 - Permission UX

목표:

실제 위치 권한 요청 전 사용자 설명 Flow 구현.

구현:

- Permission Explanation
- Permission Request Button
- Permission State UI
- Denied State
- Retry

완료 조건:

- 권한 거부 시에도 앱 사용 가능


# Phase 12 - Web Location Service

목표:

Web Geolocation을 기존 Frontend Architecture에 연결.

구현 예상:

- requestPermission
- getPermissionStatus
- getCurrentPosition
- startTracking
- stopTracking

주의:

- UI에서 navigator.geolocation 직접 호출 금지
- Background GPS는 구현하지 않음

완료 조건:

- LocationService를 통해 위치 획득 가능
- 권한 오류 처리 가능


# Phase 13 - Real API Integration Preparation

목표:

다른 팀원이 구현할 기능들을 Frontend에 연결할 준비.

연결 대상:

- Backend REST API
- Database
- Reverse Geocoding
- Behavior Inference
- STT
- LLM

작업:

- API Client
- Environment Variable
- Request / Response Type
- Error Handling
- Service 구현 교체 구조 확인

실제 Endpoint가 없는 경우
임의의 API 주소를 만들어 호출하지 않는다.


# Phase 14 - Integration

Backend와 AI API가 준비된 이후 진행.

Mock Service를 실제 Service로 단계적으로 교체한다.

권장 순서:

1. Backend / Diary CRUD
2. Timeline
3. Location
4. Reverse Geocoding
5. Behavior Inference
6. STT
7. Diary Generation
8. AI Interview


# Phase 15 - Frontend MVP Verification

전체 사용자 Flow를 검증한다.

위치

→ Timeline

→ 행동 후보

→ 사용자 확인

→ Voice / Text 보완

→ Diary Generation

→ Diary Edit

→ Save

→ History


검증:

- Mobile
- Tablet
- Desktop
- Loading
- Error
- Empty
- Permission Denied
- No Timeline
- API Failure


# Phase Completion Rule

각 Phase 완료 후 Codex는 반드시 다음 내용을 보고한다.

1. 이번 Phase에서 구현한 내용
2. 생성한 파일
3. 수정한 파일
4. 주요 Architecture 결정
5. 실행 방법
6. Build 결과
7. Test 결과
8. 현재 알려진 문제
9. 다음 Phase에서 해야 할 일


# Final Principle

기능을 빨리 많이 만드는 것보다

"나중에 실제 Backend, GPS, STT, LLM을 연결할 때
Frontend 구조를 다시 뜯어고치지 않아도 되는 것"

을 우선한다.
