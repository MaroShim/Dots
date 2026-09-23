**[English](README.md)** | [한국어](README.ko.md)

# Dots - A Game About Connecting

> A web-based clone of the minimalist puzzle game **"Dots: A Game About Connecting"**.  
> Built with HTML5 Canvas, TypeScript, Vite, and Web Audio API using pure web standards. Fully optimized for desktop browsers, mobile Safari, and iOS PWA (Progressive Web App) standalone mode.

🌐 **Live Demo**: [https://MaroShim.github.io/Dots/](https://MaroShim.github.io/Dots/)

---

## 🎮 Features & Gameplay

### 1. Intuitive and Smooth Connecting
- **6x6 Dots Grid**: Randomly generated grid featuring 5 vibrant pastel colors (Red, Blue, Green, Yellow, Purple).
- **Smooth Line Dragging**: Connect adjacent dots (horizontally or vertically) of the same color with smooth line rendering.
- **Backtracking Support**: Drag back to the previous dot to undo connections dynamically with backtrack audio feedback.

### 2. Closed Loop / Square System
- Connecting 4 or more dots into a closed loop (e.g. a 2x2 square) **clears every dot of that color across the entire board**.
- Rewarded with a special celebratory chord, full-screen color flash, and double score bonus.

### 3. Three Distinct Game Modes
| Mode | Rule | Description |
| :--- | :--- | :--- |
| **TIMED** | 60-Second Limit | Fast-paced speedrun mode to connect as many dots as possible within 60 seconds |
| **MOVES** | 30 Moves Limit | Strategic puzzle mode where every move counts toward creating large loops |
| **ENDLESS** | No Limits (Zen) | Relaxing casual mode without timer or move restrictions |

### 4. Procedural Web Audio API Sound
- 100% synthesized audio generated on-the-fly using browser **Web Audio API (`OscillatorNode` + `GainNode`)** with zero external audio assets.
- **C Major Pentatonic Scale**: Notes ascend harmoniously as you connect more dots, producing a warm, pleasant chime.
- Special audio effects for square loop completion, dot pops, and cascading waterfall drops.
- **Sound Toggle (🔊 / 🔇)** button with user preference saved in `localStorage`.
- **PLAY START** screen overlay ensuring reliable audio unlocking in full compliance with modern browser Autoplay policies.

### 5. Mobile & PWA Optimization
- **Fixed 600x600 Virtual Resolution**: Crisp rendering on high-DPI (Retina) screens with zero aspect-ratio distortion or touch coordinate offsets.
- **Unified Pointer Events**: Touch, mouse, and stylus inputs unified with `setPointerCapture` for flawless high-speed drag gestures.
- **iOS PWA Standalone Mode**: Fullscreen display without browser navigation bars, safe-area-inset padding for notches/Dynamic Island, and custom high-resolution touch icons.
- **Toggleable Fall-In Bounce**: Configurable bounce physics animation (`enableBounce` in `Board.ts`), defaulted to off for smooth, clean settling.

---

## 🛠️ Tech Stack

- **Language**: TypeScript 5.x
- **Rendering**: HTML5 Canvas 2D Context
- **Audio**: Web Audio API (Synthesized procedural audio)
- **Bundler & Build Tool**: Vite 5.x
- **Deployment & CI/CD**: GitHub Actions + GitHub Pages

---

## 📁 Project Structure

```text
DOTS/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment workflow
├── public/
│   ├── icons/                  # PWA and Apple Touch icons
│   └── manifest.webmanifest    # Web App Manifest
├── src/
│   ├── audio/
│   │   └── SoundManager.ts     # Web Audio API sound synthesis and lifecycle
│   ├── game/
│   │   ├── Board.ts            # 6x6 grid, gravity drop, refill, and animations
│   │   ├── ConnectionManager.ts# Line drawing, loop detection, and backtracking
│   │   ├── easing.ts           # Easing physics curves (Cubic, Bounce, etc.)
│   │   ├── Game.ts             # Game loop, mode states, dashboard, and modals
│   │   ├── ParticleSystem.ts   # Particle burst effects upon dot clearing
│   │   ├── Renderer.ts         # Canvas 2D rendering and DPI scaling
│   │   └── types.ts            # Shared interfaces and type definitions
│   ├── constants.ts            # Grid metrics, color palette, pentatonic frequencies
│   ├── main.ts                 # Entry point and DOM event bindings
│   └── style.css               # Responsive layout and minimalist styling
├── index.html                  # HTML5 entry template
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md                # Release history and release notes
├── LICENSE.md                  # MIT License
├── README.md                   # English documentation
└── README.ko.md                # Korean documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 1. Clone the repository and install dependencies
```bash
git clone https://github.com/MaroShim/Dots.git
cd Dots
npm install
```

### 2. Run the development server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 3. Build for production
```bash
npm run build
```
Type checks via TypeScript and bundles optimized static assets to `dist/`.

### 4. Preview the production build
```bash
npm run preview
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE.md).  
The original concept, game mechanics, and design of "Dots: A Game About Connecting" are copyright © Playdots, Inc.
