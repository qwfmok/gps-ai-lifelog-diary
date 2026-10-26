# AGENTS.md

## 1. Project Overview

본 프로젝트는 GPS 기반 행동 추론 및 LLM 기반 자동 라이프로그 일기장이다.

사용자의 GPS 및 시간 데이터를 기반으로 하루의 동선과 체류지를 기록하고,
장소와 시간 정보를 기반으로 행동 후보를 추론한다.

행동 추론이 불확실하거나 기록이 비어 있는 경우에는
사용자가 음성 또는 직접 입력을 통해 기억과 감정을 보완한다.

이후 GPS, 시간, 행동, 사용자 입력 데이터를 LLM과 결합하여
자연스러운 하루 일기를 생성하는 것을 목표로 한다.

아이디어의 출발점은 위치 기록을 기반으로 하루 동안 방문한 장소와 이동 경로를 보여주는
Google Timeline과 같은 위치 기반 라이프로그이다.

본 프로젝트에서는 단순히 이동 경로를 보여주는 것에서 더 나아가,
해당 장소에서 무엇을 했는지 추론하고 사용자의 기억과 감정을 추가하여
하나의 일기로 완성하는 경험을 제공한다.


## 2. Current Development Goal

현재 개발 단계의 최우선 목표는 완성된 AI 기능을 만드는 것이 아니다.

Frontend의 기본 구조와 UI/UX를 먼저 구축하여
향후 다음 기능들이 쉽게 연결될 수 있도록 하는 것이 목표이다.

향후 연결 대상:

- Backend REST API
- Database
- GPS / Location
- Reverse Geocoding
- Behavior Inference
- STT
- LLM
- AI Interview
- Diary Analysis

따라서 초기 Frontend는 Mock Data와 Mock Service를 사용하더라도
전체 사용자 흐름이 동작하도록 설계한다.


## 3. Core User Experience

서비스의 핵심 사용자 흐름은 다음과 같다.

GPS 및 시간 기록

→ 체류지 확인

→ 장소 정보 확인

→ 행동 후보 확인

→ 불확실한 행동 보완

→ 기억과 감정 입력

→ LLM 기반 일기 생성

→ 생성된 일기 확인 및 수정

→ 저장

→ 과거 기록 조회


## 4. Architecture Principles

다음 원칙을 반드시 따른다.

1. UI와 데이터 처리 로직을 분리한다.

2. Page 또는 Component에서 직접 API를 호출하지 않는다.

3. 외부 데이터 접근은 Service Layer를 통해 수행한다.

4. Backend가 없어도 Mock Service를 사용해 Frontend 전체 흐름이 동작해야 한다.

5. Mock Service와 실제 API Service를 쉽게 교체할 수 있도록 설계한다.

6. GPS 기능은 Location 관련 Service로 격리한다.

7. 음성 및 STT 기능은 Voice 관련 Service로 격리한다.

8. 일기 기능은 Diary 관련 Service로 격리한다.

9. Timeline 데이터 처리는 Timeline 관련 Service로 격리한다.

10. 행동 추론 기능은 Behavior 관련 Service 또는 향후 Backend API로 교체할 수 있도록 한다.

11. Component 내부에 하드코딩된 테스트 데이터를 직접 작성하지 않는다.

12. 반복되는 UI는 재사용 가능한 Component로 분리한다.

13. UI Component에 복잡한 비즈니스 로직을 넣지 않는다.

14. Type을 명확하게 정의한다.

15. 모든 비동기 기능은 다음 상태를 고려한다.

- idle
- loading
- success
- empty
- error

16. 모바일 환경을 우선으로 설계한다.

17. Desktop에서도 Layout이 깨지지 않도록 Responsive Design을 적용한다.

18. 위치정보와 개인정보는 사용자의 명시적인 동의를 전제로 처리한다.


## 5. Recommended Application Layers

Frontend 구조는 개념적으로 다음 흐름을 따른다.

Page

→ Component

→ Hook / State

→ Service

→ Mock API 또는 Real API


예:

TodayPage

→ DailyTimeline

→ useTimeline

→ TimelineService

→ MockTimelineService


Backend 연결 이후에는 UI 구조를 변경하지 않고

MockTimelineService

를

RealTimelineService

또는 실제 Backend API 연결 Service로 교체할 수 있어야 한다.


## 6. Location Rule

React Component 또는 Page에서 `navigator.geolocation`을 직접 사용하지 않는다.

위치 관련 기능은 반드시 Location Service를 통해 접근한다.

향후 다음과 같은 기능을 제공할 수 있어야 한다.

- requestPermission()
- getCurrentPosition()
- startTracking()
- stopTracking()
- getPermissionStatus()

초기 Web/PWA 버전에서는 Web Geolocation을 사용할 수 있다.

지속적인 Background GPS가 필요해지는 경우
추후 Native 또는 Hybrid Application으로 확장할 수 있도록 구조를 분리한다.


## 7. Voice / STT Rule

음성 UI와 실제 STT 구현을 분리한다.

초기 단계에서는 Mock STT 결과를 사용할 수 있어야 한다.

향후 실제 STT API가 연결되더라도
화면 Component를 크게 수정하지 않도록 Service Interface를 둔다.


## 8. LLM Rule

Frontend에서 직접 LLM API Key를 사용하거나 LLM Provider를 직접 호출하지 않는다.

향후 LLM 호출은 Backend를 통해 처리하는 것을 기본 원칙으로 한다.

초기 Frontend 개발에서는 Mock Diary Generation 결과를 사용한다.


## 9. Initial Frontend Scope

초기 Frontend MVP에서 준비할 화면은 다음과 같다.

- Today / Home
- Daily Timeline
- Activity Confirmation
- Voice Record
- Diary Generation
- Diary Editor
- Diary History
- Diary Detail
- Settings
- Permission / Privacy UI


## 10. Initial Development Exclusions

초기 Frontend 골격 단계에서는 다음 기능의 실제 알고리즘을 구현하지 않는다.

- 실제 AI 행동 추론
- 실제 LLM 호출
- 실제 STT 모델
- 실제 지도 API 역지오코딩
- 지속적인 Background GPS
- Vector Database
- 장기 행동 패턴 분석
- 실제 AI 회고 분석

위 기능은 Interface와 Mock Service를 통해 연결 가능성만 준비한다.


## 11. Privacy UX

위치 권한을 요청하기 전에
위치정보를 사용하는 목적을 사용자에게 설명해야 한다.

사용자는 향후 다음 사항을 직접 제어할 수 있어야 한다.

- 위치 추적 활성화
- 위치 추적 비활성화
- 위치 기록 삭제
- 일기 삭제
- 전체 데이터 삭제

사용자가 위치 권한을 거부하더라도
Application 전체가 비정상 종료되어서는 안 된다.


## 12. Coding Guidelines

실제 코드 구현이 시작되면 다음 기준을 따른다.

- TypeScript 사용
- 명확한 Component 책임 분리
- 명확한 Type 정의
- 재사용 가능한 Component 작성
- 불필요한 전역 상태 최소화
- Service Layer 사용
- Mock Data 분리
- Loading State 구현
- Empty State 구현
- Error State 구현
- 사용자에게 이해 가능한 Error Message 제공
- 접근성을 고려한 HTML 구조 사용
- Mobile First Responsive Design 적용
- 불필요한 Dependency 추가 금지
- 환경변수가 필요한 값은 코드에 직접 하드코딩하지 않는다.


## 13. Codex Working Rules

Codex는 작업 전에 다음 문서를 순서대로 확인한다.

1. AGENTS.md
2. FRONTEND_SPEC.md
3. IMPLEMENTATION_PLAN.md

단, 해당 문서가 아직 존재하지 않는 초기 단계에서는
현재 존재하는 문서만 확인한다.

Codex는 IMPLEMENTATION_PLAN.md에서 사용자가 지정한 Phase만 구현한다.

사용자가 명시적으로 요청하지 않은 다음 Phase를 임의로 구현하지 않는다.

기존 구조를 크게 변경해야 한다면 먼저 그 이유를 설명한다.

각 Phase 완료 후 다음 내용을 보고한다.

1. 구현한 기능
2. 생성한 파일
3. 수정한 파일
4. 중요한 설계 결정
5. Build 또는 Test 결과
6. 현재 남아 있는 문제
7. 다음 Phase 진행 전 확인할 사항


## 14. Important Principle

이 프로젝트의 초기 Frontend 목표는

"완성된 기능을 모두 구현하는 것"

이 아니라

"향후 여러 기능이 안정적으로 연결될 수 있는 Frontend 기반을 구축하는 것"

이다.

Frontend 전체 구조는 이 원칙을 우선하여 설계한다.
