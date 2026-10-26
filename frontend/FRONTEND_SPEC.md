# FRONTEND_SPEC.md

## 1. Product Overview

프로젝트명:

GPS 기반 행동 추론 및 LLM 기반 자동 라이프로그 일기장

서비스 목표:

사용자가 하루의 모든 내용을 직접 작성하지 않아도
GPS와 시간 데이터를 이용해 하루의 기본적인 흐름을 먼저 기록하고,
부족한 기억이나 감정만 보완하여 자연스러운 일기를 완성할 수 있도록 한다.

위치 기반 라이프로그를 단순 이동 경로 표시에서 끝내지 않고
행동과 기억, 감정까지 포함한 하루의 기록으로 확장하는 것이 목적이다.


## 2. Core Concept

핵심 개념:

"시스템이 하루의 뼈대를 먼저 만들고,
사용자는 시스템이 알 수 없는 부분만 보완한다."

다음 흐름을 중심으로 UX를 설계한다.

GPS / 시간

→ 체류지

→ 장소

→ 행동 후보

→ 사용자 확인

→ 기억 / 감정

→ 일기 생성


## 3. Primary Target Device

초기 UI는 Mobile First로 설계한다.

우선 고려 해상도:

- 일반적인 스마트폰
- 작은 스마트폰
- Tablet
- Desktop

Desktop에서도 사용 가능해야 하지만
핵심 사용 경험은 Smartphone을 기준으로 한다.


## 4. Main Navigation

초기 Navigation은 다음 세 영역을 기본으로 한다.

1. Today
2. History
3. Settings

Mobile에서는 Bottom Navigation 사용을 우선 고려한다.


## 5. Today Page

Today Page는 서비스의 핵심 화면이다.

사용자는 앱을 실행했을 때
오늘 하루의 기록 상태를 바로 확인할 수 있어야 한다.

주요 영역:

- 현재 날짜
- 오늘 기록 상태
- Timeline
- Location Event
- Activity Status
- 사용자 보완 필요 여부
- 오늘의 메모 / 기억
- 일기 생성 버튼


예시:

2026년 9월 23일

오늘의 기록

09:00 - 11:00
연세대학교
활동: 수업
상태: 확인됨

12:10 - 13:00
학생식당
활동: 식사
상태: 확인됨

15:00 - 17:00
카페
활동: 불확실
상태: 사용자 확인 필요

18:00 - 20:00
도서관
활동: 공부
상태: 추론됨


하단:

오늘의 기록 완성도

[오늘의 일기 만들기]


## 6. Timeline

Timeline은 서비스에서 가장 중요한 UI Component이다.

Timeline Event는 최소 다음 정보를 표현할 수 있어야 한다.

- 시작 시간
- 종료 시간
- 장소명
- 장소 카테고리
- 행동 후보
- 행동 신뢰도
- 사용자 확인 여부
- 메모
- 감정
- 데이터 출처


Timeline Event 상태 예시:

CONFIRMED
사용자가 확인한 행동

INFERRED
시스템이 추론했으나 추가 확인이 필요하지 않은 행동

UNCERTAIN
추론 신뢰도가 낮아 사용자 확인이 필요한 행동

EMPTY
정보가 부족한 구간


각 상태가 UI에서 구별되어야 한다.


## 7. Activity Confirmation

UNCERTAIN 또는 EMPTY 상태에서는
사용자에게 맥락 보완 UI를 제공한다.

예:

15:00 ~ 17:00
카페

"이 시간에는 무엇을 하셨나요?"

추천 행동:

- 공부
- 친구 만남
- 휴식
- 업무
- 직접 입력

사용자는 행동을 선택하거나 직접 작성할 수 있다.

확정 후 Timeline에 즉시 반영되어야 한다.


## 8. AI Interview UI

AI Interview는 행동이나 맥락이 불확실한 구간을 보완하기 위한 기능이다.

초기 Frontend에서는 실제 AI 질문 생성 기능을 구현하지 않고
Mock 질문을 사용한다.

예:

"오후 3시부터 5시까지 카페에 계셨습니다.
이 시간에는 어떤 활동을 하셨나요?"

사용자 응답 방법:

- 추천 행동 선택
- Text 입력
- Voice 입력


## 9. Voice Record

Voice Record UI에서는 다음 상태를 제공한다.

IDLE

RECORDING

PROCESSING

COMPLETED

ERROR


필요 기능:

- 녹음 시작
- 녹음 시간
- 녹음 중지
- 취소
- 다시 녹음
- 처리 상태
- STT 결과 표시
- STT 결과 수정


초기 버전에서는 실제 STT API 없이
Mock STT Result를 사용할 수 있다.


## 10. Diary Generation

Timeline과 사용자 보완 데이터가 준비되면
사용자가 일기 생성을 요청할 수 있다.

버튼 예:

"오늘의 일기 만들기"


상태:

IDLE

GENERATING

GENERATED

ERROR


생성 중에는 Loading UI를 표시한다.

초기 Frontend에서는 Mock Diary를 반환한다.


예:

"오늘 오전에는 학교에서 수업을 들었다.
점심에는 학생식당에서 식사를 했고,
오후에는 카페에서 친구와 팀 프로젝트를 진행했다..."


## 11. Diary Editor

생성된 일기는 사용자가 반드시 수정 가능해야 한다.

기능:

- Edit
- Save
- Cancel
- Delete
- Regenerate

일기는 AI가 생성하더라도
최종 기록의 통제권은 사용자에게 있다.


## 12. History

과거 일기를 날짜순으로 확인할 수 있어야 한다.

List Item 정보:

- 날짜
- Diary Preview
- 대표 감정
- 주요 키워드
- 방문 장소 일부

초기 MVP에서는 날짜와 Diary Preview만 구현해도 된다.


## 13. Diary Detail

과거 일기를 선택하면 상세 내용을 확인한다.

표시 정보:

- 날짜
- 생성된 일기
- Timeline 요약
- 장소
- 행동
- 감정
- 키워드

초기 구현에서는 일부 데이터가 Mock일 수 있다.


## 14. Settings

Settings에서 다음 항목을 제공할 수 있도록 설계한다.

위치

- 위치 권한 상태
- 위치 추적 ON/OFF

데이터

- 위치 기록 삭제
- 일기 기록 삭제
- 전체 데이터 삭제

개인정보

- 위치정보 사용 목적
- 데이터 처리 안내


## 15. Permission UX

앱을 처음 실행했다고 바로 Browser Permission Popup을 호출하지 않는다.

먼저 자체 설명 UI를 보여준다.

예:

"하루의 이동과 체류지를 기록하기 위해 위치정보가 필요합니다."

[위치 사용 허용]

사용자가 버튼을 누른 후
실제 Browser Permission을 요청한다.


위치 권한 상태:

UNKNOWN

GRANTED

DENIED

UNAVAILABLE


권한이 없어도 앱 자체는 실행되어야 한다.


## 16. Data Models

향후 실제 TypeScript 구현을 위한 기본 모델은 다음 개념을 포함한다.


User

Diary

TimelineEvent

LocationPoint

Place

Activity

VoiceRecord

DiaryGenerationResult


TimelineEvent 예시 필드:

id

date

startTime

endTime

place

placeCategory

activity

confidence

status

userConfirmed

note

emotion


Activity 예시:

id

name

category

source

confidence


## 17. Timeline Mock Data Example

개발 초기에는 다음과 유사한 Mock 데이터를 사용한다.

09:00 - 11:00
장소: 연세대학교
행동: 수업
Confidence: 0.95
Status: CONFIRMED

12:10 - 13:00
장소: 학생식당
행동: 식사
Confidence: 0.92
Status: INFERRED

15:00 - 17:00
장소: 카페
행동: UNKNOWN
Confidence: 0.35
Status: UNCERTAIN

18:00 - 20:00
장소: 도서관
행동: 공부
Confidence: 0.84
Status: INFERRED


## 18. Service Architecture

다음 Service 영역을 준비한다.

LocationService

TimelineService

ActivityService

VoiceService

DiaryService


초기:

Component

→ Service Interface

→ Mock Service


향후:

Component

→ 동일한 Service Interface

→ Backend API


Component는 Mock인지 Real API인지 몰라도 동작해야 한다.


## 19. Location Service

향후 다음 Interface를 지원할 수 있도록 한다.

requestPermission()

getPermissionStatus()

getCurrentPosition()

startTracking()

stopTracking()


초기 단계에서는 Mock 또는 Web Geolocation을 사용한다.

Background GPS는 초기 Frontend 구현 범위에서 제외한다.


## 20. Timeline Service

예상 기능:

getTimeline(date)

updateActivity(eventId, activity)

addNote(eventId, note)

confirmEvent(eventId)


## 21. Voice Service

예상 기능:

startRecording()

stopRecording()

cancelRecording()

transcribe()


초기에는 Mock transcription 사용 가능.


## 22. Diary Service

예상 기능:

generateDiary(date)

getDiaries()

getDiary(id)

saveDiary(diary)

updateDiary(id, content)

deleteDiary(id)


## 23. Future Backend API Boundary

Frontend 내부 구현이 특정 Backend Framework에 의존하지 않도록 한다.

Frontend는 API Contract만 알고 있어야 한다.

향후 예시 Endpoint:

GET /api/timeline/{date}

PATCH /api/timeline/events/{id}

POST /api/voice/transcribe

POST /api/diaries/generate

GET /api/diaries

GET /api/diaries/{id}

PUT /api/diaries/{id}

DELETE /api/diaries/{id}


현재 Backend가 존재하지 않으므로
초기 구현에서는 실제 Endpoint를 호출하지 않는다.


## 24. Error State

다음 상황을 고려한다.

- 위치 권한 거부
- 위치정보 획득 실패
- Timeline 없음
- 녹음 실패
- STT 실패
- Diary Generation 실패
- Network Error
- 저장 실패


사용자에게 기술적인 Error Stack을 그대로 노출하지 않는다.


## 25. Empty State

다음 Empty State를 고려한다.

오늘 위치 기록 없음

오늘 Timeline 없음

저장된 일기 없음

음성 기록 없음


Empty State에서는 사용자가 다음에 무엇을 해야 하는지 알려준다.


## 26. Loading State

다음 작업에는 Loading 상태를 제공한다.

Timeline Loading

Diary Generation

STT Processing

Diary Saving

History Loading


## 27. Privacy Requirements

위치 데이터는 민감한 데이터로 취급한다.

Frontend UX에는 다음 원칙을 반영한다.

- 목적 설명 후 권한 요청
- 추적 상태 표시
- 사용자가 추적 중지 가능
- 기록 삭제 가능
- 데이터 삭제 결과 안내


## 28. Accessibility

기본적으로 다음을 고려한다.

- Button은 명확한 Label 사용
- Icon만 있는 경우 aria-label 고려
- Keyboard Navigation 고려
- Form Label 제공
- 충분한 Touch Target
- 의미 있는 HTML 구조 사용


## 29. Responsive Design

Mobile First.

작은 스마트폰에서도 Timeline이 잘려서는 안 된다.

Tablet 및 Desktop에서는
중앙 Content Width를 제한하여 지나치게 넓어지지 않도록 한다.


## 30. Visual Direction

전체 UI 방향:

- Minimal
- Calm
- Personal
- Diary
- Timeline 중심
- 낮은 인지 부담

지나치게 기술적인 AI Dashboard처럼 디자인하지 않는다.

사용자가

"내 하루를 확인하고 부족한 부분만 보완한다"

고 느끼는 것이 중요하다.


## 31. Future Expansion

현재 구조는 향후 다음 기능 확장을 고려한다.

- 실제 Background GPS
- Native / Hybrid App
- Reverse Geocoding
- Behavior Inference
- AI Interview
- Real STT
- Real LLM
- Emotion Analysis
- Keyword Extraction
- Long-term Behavior Analysis
- Calendar Integration
- Healthcare Platform Integration
- Vector Search


## 32. Frontend MVP Definition of Done

초기 Frontend MVP가 완료되었다고 판단하기 위한 조건:

1. Today 화면을 볼 수 있다.
2. Mock Timeline이 표시된다.
3. 행동 추론 결과를 확인할 수 있다.
4. 불확실한 행동을 사용자가 수정할 수 있다.
5. Voice Record UI가 동작한다.
6. Mock STT 결과를 표시할 수 있다.
7. Diary Generate Flow가 동작한다.
8. Mock Diary가 생성된다.
9. 일기를 수정할 수 있다.
10. 일기를 저장할 수 있다.
11. 과거 일기를 확인할 수 있다.
12. Settings를 사용할 수 있다.
13. 위치 권한 UI가 존재한다.
14. Tracking ON/OFF UI가 존재한다.
15. Mock Service를 실제 API Service로 교체할 수 있는 구조이다.


## 33. Most Important UX Principle

사용자가 시스템을 위해 데이터를 계속 입력하는 구조가 되어서는 안 된다.

시스템이 먼저 하루의 기본 기록을 만들고,

사용자는

"틀린 부분"

또는

"시스템이 모르는 부분"

만 보완하는 구조여야 한다.
