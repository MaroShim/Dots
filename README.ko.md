# Dots - A Game About Connecting

<p align="center">
  <b><a href="README.md#-english">English</a></b> | <b><a href="README.md#-한국어">한국어 (Overview)</a></b>
</p>

> 미니멀리즘 퍼즐 게임 **"Dots: A Game About Connecting"**의 웹 기반 클론 프로젝트입니다.  
> HTML5 Canvas, TypeScript, Vite, Web Audio API를 기반으로 순수 웹 표준 기술로 제작되었으며, 모바일 사파리 및 PWA(Progressive Web App) 환경을 완벽하게 지원합니다.

🌐 **라이브 데모**: [https://MaroShim.github.io/Dots/](https://MaroShim.github.io/Dots/)

---

## 🎮 게임 특징 및 기능

### 1. 직관적이고 부드러운 연결 플레이
- **6x6 점 그리드**: 5가지 파스텔 컬러(Red, Blue, Green, Yellow, Purple)의 점들이 무작위 배치됩니다.
- **스무스 라인 드래깅**: 터치 또는 마우스 드래그로 상/하/좌/우 인접한 같은 색상의 점들을 부드러운 곡선으로 연결합니다.
- **되돌리기(Backtracking)**: 손가락을 이전 점으로 되돌리면 연결이 자연스럽게 취소되며 오디오 피드백이 제공됩니다.

### 2. 사각형 루프 (Square Loop) 시스템
- 4개 이상의 점으로 폐곡선(루프/사각형)을 형성하면, **화면 전체에 존재하는 해당 색상의 모든 점이 한꺼번에 클리어**됩니다.
- 루프 형성 시 전용 축하 화음과 시각적 펄스 이펙트, 더블 스코어 보너스가 부여됩니다.

### 3. 3가지 게임 모드
| 모드 | 규칙 | 설명 |
| :--- | :--- | :--- |
| **TIMED** | 60초 제한 | 제한 시간 내에 최대한 많은 점을 연결하여 최고 기록을 경신하는 스피드런 모드 |
| **MOVES** | 30회 이동 제한 | 한 수 한 수 전략적으로 큰 루프를 설계하며 점수를 극대화하는 전략 퍼즐 모드 |
| **ENDLESS** | 제한 없음 (Zen) | 시간과 이동 횟수 압박 없이 편안하게 점을 이으며 즐길 수 있는 힐링 모드 |

### 4. 순수 Web Audio API 절차적 사운드
- 외부 MP3/WAV 오디오 에셋 다운로드 없이, 브라우저의 **Web Audio API (`OscillatorNode` + `GainNode`)**로 합성되는 오가닉 사운드.
- **C 메이저 펜타토닉 음계 (도-레-미-솔-라)**: 점을 하나씩 연결할 때마다 한 음씩 올라가는 부드럽고 편안한 피아노/실로폰 톤.
- 루프 완성 화음, 점 제거 팝 사운드, 중력 낙하 빗소리 효과음, 음소거(🔊 / 🔇) 토글 및 브라우저 영구 보관.
- 최신 브라우저의 Autoplay Policy(자동재생 제한)를 완벽히 준수하는 **PLAY START** 진입 화면 적용.

### 5. 모바일 최적화 & PWA
- **고해상도 600x600 가상 해상도 렌더링**: 기기 픽셀 비율(DPR) 왜곡이나 비율 깨짐 없는 선명한 캔버스 그래픽 및 정확한 터치 좌표 보정.
- **Pointer Events 통일**: 터치, 마우스, 펜 입력을 단일 파이프라인으로 통합하고 `setPointerCapture`로 끊김 없는 드래그 보장.
- **iOS PWA Standalone 지원**: 홈 화면에 추가 시 주소창 없는 전체 화면 실행, 노치/다이내믹 아일랜드 대응 Safe-Area 패딩, 전용 앱 아이콘 탑재.

---

## 🛠️ 기술 스택

- **언어**: TypeScript 5.x
- **렌더링**: HTML5 Canvas 2D Context
- **오디오**: Web Audio API (합성 사운드)
- **번들러 & 빌드 도구**: Vite 5.x
- **배포 & CI/CD**: GitHub Actions + GitHub Pages

---

## 📁 프로젝트 구조

```text
DOTS/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages 자동 배포 워크플로우
├── public/
│   ├── icons/                  # PWA 및 터치 아이콘
│   └── manifest.webmanifest    # PWA 매니페스트 설정
├── src/
│   ├── audio/
│   │   └── SoundManager.ts     # Web Audio API 사운드 합성 및 생명주기 관리
│   ├── game/
│   │   ├── Board.ts            # 6x6 그리드, 중력 낙하 및 리필, 애니메이션
│   │   ├── ConnectionManager.ts# 선 연결, 루프 검출, 되돌리기 로직
│   │   ├── easing.ts           # 물리 애니메이션 감속 곡선 (Cubic, Bounce 등)
│   │   ├── Game.ts             # 게임 루프, 모드 상태, 대시보드 및 모달 제어
│   │   ├── ParticleSystem.ts   # 점 제거 시 발생하는 파티클 폭발 이펙트
│   │   ├── Renderer.ts         # 캔버스 2D 렌더링 및 해상도 조정
│   │   └── types.ts            # 공용 타입 및 인터페이스
│   ├── constants.ts            # 보드 크기, 색상 팔레트, 펜타토닉 주파수 상수
│   ├── main.ts                 # 애플리케이션 진입점 및 DOM 이벤트 바인딩
│   └── style.css               # 반응형 레이아웃 및 다크/라이트 미니멀 스타일링
├── index.html                  # 메인 HTML 템플릿
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md                # 버전별 변경 이력
├── LICENSE.md                  # MIT 라이선스
├── README.md                   # 영문 문서
└── README.ko.md                # 한글 문서
```

---

## 🚀 로컬 실행 및 빌드 방법

### 요구 사항
- Node.js (v18 이상 권장)
- npm

### 1. 저장소 클론 및 패키지 설치
```bash
git clone https://github.com/MaroShim/Dots.git
cd Dots
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:5173/`으로 접속하여 테스트할 수 있습니다.

### 3. 프로덕션 빌드
```bash
npm run build
```
TypeScript 타입 검증 후 `dist/` 폴더에 최적화된 프로덕션 번들이 생성됩니다.

### 4. 프로덕션 프리뷰
```bash
npm run preview
```

---

## 📜 라이선스

이 프로젝트는 [MIT License](LICENSE.md)에 따라 자유롭게 사용 및 수정이 가능합니다.
원본 "Dots: A Game About Connecting"의 게임 콘셉트 및 디자인 권리는 원작자(Playdots, Inc.)에 있습니다.
