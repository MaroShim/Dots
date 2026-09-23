# Changelog

모든 중요한 변경 사항은 이 파일에 기록됩니다.  
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/) 표준을 따릅니다.

---

## [1.0.0] - 2026-09-24

### Added
- **PLAY START 시작 화면 도입**:
  - 첫 페이지 접속 시 원작 감성의 미니멀 오버레이 타이틀 및 `PLAY` 시작 버튼 추가 (`#game-start-modal`, `#start-game-btn`).
  - 브라우저 Autoplay Policy에 의해 첫 드래그 시 소리가 차단되던 문제를 정식 사용자 클릭 제스처로 완전 해결.
  - `PLAY` 클릭 시 경쾌한 빗소리 효과음과 함께 점들이 위에서 내려오는 시작 연출 제공.
- **낙하 바운스 애니메이션 On/Off 토글 기능**:
  - `Board.ts`에 `enableBounce` 속성 및 `setBounceEnabled(boolean)` 메서드 추가.
  - `src/game/easing.ts`에 부드러운 감속을 위한 `easeOutCubic(x)` 곡선 추가.
  - 요청에 따라 기본값을 **Off (`enableBounce: false`)**로 설정하여, 튕김 없이 부드럽고 산뜻하게 착지하도록 개편.
- **모드 전환 인터랙션 사운드**:
  - 상단 탭에서 게임 모드(TIMED / MOVES / ENDLESS) 변경 시 점들이 쏟아지는 사운드 및 리필 연출 적용.
- **사운드 켜기 확인음**:
  - 헤더의 🔊 버튼을 눌러 음소거를 해제할 때 즉시 3단 차임벨(`도-미-솔`)이 울리도록 피드백 제공.

### Changed
- **오디오 음색 및 볼륨 정밀 튜닝**:
  - 과도하게 크고 쨍하게 들리던 배음(오버톤)을 제거하고 순수 사인파(Sine Wave)로 복원.
  - 점 연결음 피크 볼륨을 `0.57`에서 편안하고 부드러운 `0.20`으로 감쇄하여 원작의 아늑한 감성 회복.
  - 음표 감쇄 시간(Decay)을 `0.23초`로 다듬어 빠른 연속 연결 시에도 음이 뭉치지 않도록 개선.
- **Web Audio 파이프라인 정리**:
  - 오디오 세션을 간섭하던 불필요한 백그라운드 HTML5 `<audio>` 요소를 제거하고 순수 Web Audio API로 일원화.
  - 사운드 노드를 `ctx.destination`으로 직결하여 게인 노드 병목 현상 제거.

### Refactored
- **물리/애니메이션 모듈 분리**:
  - `Board.ts` 내부에 인라인되어 있던 Easing 수학 공식을 `src/game/easing.ts` 모듈로 분리.
- **상수 표준화**:
  - 보드 크기 관련 매직 넘버들을 `GRID_SIZE` 상수로 일원화.
- **localStorage 안전성 강화**:
  - 시크릿 모드나 쿠키 차단 환경에서도 예외가 발생하지 않도록 최고 점수 및 음소거 설정 읽기/쓰기에 try-catch 래핑 적용.

---

## [0.9.0] - 2026-09-23

### Fixed
- **초기 로딩 시 치명적 TypeError 해결**:
  - `Board` 생성자에서 셀 크기 계산 전에 `getCellCenter()`를 호출하여 발생하던 `Cannot read properties of undefined (reading '0')` 예외 수정.
  - 지표 계산(`setupMetrics`)과 그리드 생성(`initGrid`) 단계의 실행 순서 분리.
- **가상 해상도(600x600) 고정 및 DPR 왜곡 해결**:
  - CSS 미디어 쿼리 및 DPR(Device Pixel Ratio) 연산 과정에서 캔버스 가로폭이 반토막 나거나 점들이 납작해지던 문제를 600x600 내부 버퍼 고정 방식으로 완전 해결.
  - 터치 및 마우스 좌표를 캔버스 버퍼 해상도에 1:1로 비례 변환하는 `getPos()` 헬퍼 도입으로 터치 오프셋 오류 제거.
- **Pointer Events 통일**:
  - `touchstart`, `touchmove`, `mousedown`, `mousemove` 등으로 파편화되어 있던 입력을 Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`)로 단일화.
  - `setPointerCapture`를 적용하여 캔버스 경계를 벗어나는 고속 스와이프 드래그 시에도 연결이 끊기지 않도록 개선.
- **점 미출력 방지 (ResizeObserver & Auto-healing)**:
  - 캔버스 크기 변화를 실시간 감지하는 `ResizeObserver` 및 그리드 미초기화 시 자동 복원 로직 추가.

### Chore
- 저장소 영문 대소문자 명칭 변경(`dots` ↔ `Dots`)에 따른 GitHub Pages 배포 동기화 및 원격 URL 정비.

---

## [0.8.0] - 2026-09-10

### Added
- **코어 게임플레이 구현**:
  - HTML5 Canvas 기반 6x6 그리드 렌더링.
  - 5색(빨강, 파랑, 초록, 노랑, 보라) 점 무작위 생성 및 직교 인접 선 연결.
  - 4개 이상 연결 시 폐곡선을 감지하는 **사각형 루프(Square Loop)** 판정 로직.
  - 루프 형성 시 해당 색상 전체 제거 및 더블 스코어 보너스 부여.
  - 점 제거 시 중력에 의해 기존 점이 아래로 떨어지고 위에서 새 점이 채워지는 낙하 및 리필 시스템.
  - 점 클리어 시 터지는 색상별 파티클 시스템 (`ParticleSystem.ts`).
- **3가지 게임 모드**:
  - **TIMED**: 60초 타이머 카운트다운 스피드런 모드.
  - **MOVES**: 30회 이동 횟수 제한 모드.
  - **ENDLESS**: 시간/이동 제한 없는 무제한 힐링 모드.
- **게임오버 및 재시작 시퀀스**:
  - 타임오버/이동 소진 시 화면의 모든 점이 1초간 바닥으로 우수수 쏟아져 사라진 뒤 최종 점수 모달 노출.
  - 모달의 `PLAY AGAIN` 및 하단 `RESTART` 버튼을 누르면 새 점들이 쏟아져 내리며 게임 재시작.
  - 로컬 스토리지를 이용한 모드별 최고 기록(BEST) 영구 보관.
- **Web Audio API 절차적 사운드**:
  - C 메이저 펜타토닉 음계 기반 점 연결 차임벨.
  - 되돌리기 톤, 루프 완성 장조 화음, 낙하 빗소리 효과음.
  - 헤더의 사운드 On/Off 토글 버튼.
- **PWA (Progressive Web App) & iOS 지원**:
  - `manifest.webmanifest`, 고해상도 앱 아이콘(192x192, 512x512, 애플 터치 아이콘).
  - iOS 사파리 전체 화면(`apple-mobile-web-app-capable`) 및 노치 대응 `viewport-fit=cover` 설정.
- **CI/CD 자동 배포**:
  - GitHub Actions를 통한 `main` 브랜치 자동 빌드 및 GitHub Pages 배포 파이프라인 구축 (`deploy.yml`).
