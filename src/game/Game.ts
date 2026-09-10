import { Board } from './Board';
import { ConnectionManager } from './ConnectionManager';
import { ParticleSystem } from './ParticleSystem';
import { Renderer } from './Renderer';
import { SoundManager } from '../audio/SoundManager';
import { GameMode } from './types';
import { TIMED_INITIAL_SECONDS, MOVES_INITIAL_COUNT } from '../constants';

export class Game {
  public board: Board;
  public connectionManager: ConnectionManager;
  public particleSystem: ParticleSystem;
  public renderer: Renderer;
  public soundManager: SoundManager;

  public mode: GameMode = 'timed';
  public score: number = 0;
  public timeLeft: number = TIMED_INITIAL_SECONDS;
  public movesLeft: number = MOVES_INITIAL_COUNT;
  public isGameOver: boolean = false;
  private timerInterval: number | null = null;
  private isInteracting: boolean = false;

  // DOM Elements
  private metricLabelEl: HTMLElement;
  private metricValueEl: HTMLElement;
  private currentScoreEl: HTMLElement;
  private bestScoreEl: HTMLElement;
  private loopBannerEl: HTMLElement;
  private modalEl: HTMLElement;
  private modalFinalScoreEl: HTMLElement;
  private modalBestScoreEl: HTMLElement;
  private modalNewBestEl: HTMLElement;

  constructor(private canvas: HTMLCanvasElement) {
    this.soundManager = new SoundManager();
    this.board = new Board();
    this.connectionManager = new ConnectionManager(this.board, this.soundManager);
    this.particleSystem = new ParticleSystem();
    this.renderer = new Renderer(canvas, this.board, this.connectionManager, this.particleSystem);

    // Cache DOM Elements
    this.metricLabelEl = document.getElementById('metric-label')!;
    this.metricValueEl = document.getElementById('metric-value')!;
    this.currentScoreEl = document.getElementById('current-score')!;
    this.bestScoreEl = document.getElementById('best-score')!;
    this.loopBannerEl = document.getElementById('loop-banner')!;
    this.modalEl = document.getElementById('game-over-modal')!;
    this.modalFinalScoreEl = document.getElementById('modal-final-score')!;
    this.modalBestScoreEl = document.getElementById('modal-best-score')!;
    this.modalNewBestEl = document.getElementById('modal-new-best')!;

    this.bindEvents();
    this.initGame();
  }

  public initGame(withRainIn: boolean = false) {
    this.score = 0;
    this.isGameOver = false;
    this.timeLeft = TIMED_INITIAL_SECONDS;
    this.movesLeft = MOVES_INITIAL_COUNT;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.connectionManager.reset();
    this.renderer.resize();

    this.updateDashboard();
    this.hideGameOverModal();
    this.loopBannerEl.classList.remove('show');

    if (withRainIn) {
      this.soundManager.playFallInSound();
      this.board.startFallIn(() => {
        if (this.mode === 'timed' && !this.isGameOver) {
          this.startTimer();
        }
      });
    } else {
      this.board.initGrid();
      if (this.mode === 'timed') {
        this.startTimer();
      }
    }
  }

  public setMode(newMode: GameMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.initGame();
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (this.isGameOver) return;
      this.timeLeft--;
      this.updateDashboard();

      if (this.timeLeft <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  private endGame() {
    this.isGameOver = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const currentBest = this.getBestScore();
    const isNewBest = this.score > currentBest;
    if (isNewBest) {
      this.saveBestScore(this.score);
    }

    this.modalFinalScoreEl.textContent = this.score.toString();
    this.modalBestScoreEl.textContent = Math.max(this.score, currentBest).toString();
    if (isNewBest && this.score > 0) {
      this.modalNewBestEl.classList.remove('hidden');
    } else {
      this.modalNewBestEl.classList.add('hidden');
    }

    // 1초에 걸쳐 화면의 모든 점이 바닥으로 우수수 떨어져 완전히 사라진 후 모달 오픈!
    this.soundManager.playFallOutSound();
    this.board.startFallOut(() => {
      this.modalEl.classList.remove('hidden');
    });
  }

  private hideGameOverModal() {
    this.modalEl.classList.add('hidden');
  }

  private updateDashboard() {
    this.currentScoreEl.textContent = this.score.toString();
    this.bestScoreEl.textContent = this.getBestScore().toString();

    if (this.mode === 'timed') {
      this.metricLabelEl.textContent = 'TIME';
      this.metricValueEl.textContent = Math.max(0, this.timeLeft).toString();
    } else if (this.mode === 'moves') {
      this.metricLabelEl.textContent = 'MOVES';
      this.metricValueEl.textContent = Math.max(0, this.movesLeft).toString();
    } else {
      this.metricLabelEl.textContent = 'MODE';
      this.metricValueEl.textContent = 'ZEN';
    }
  }

  private getBestScore(): number {
    const key = `dots_best_score_${this.mode}`;
    return parseInt(localStorage.getItem(key) || '0', 10);
  }

  private saveBestScore(score: number) {
    const key = `dots_best_score_${this.mode}`;
    localStorage.setItem(key, score.toString());
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.renderer.resize());

    // Pointer coordinates helper (handles CSS scaling)
    const getPos = (e: MouseEvent | Touch): { x: number; y: number } => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isGameOver || this.board.isAnimating) return;
      const pos = getPos(e);
      this.isInteracting = this.connectionManager.handlePointerDown(pos.x, pos.y);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isInteracting || this.isGameOver || this.board.isAnimating) return;
      const pos = getPos(e);
      this.connectionManager.handlePointerMove(pos.x, pos.y);
      this.updateLoopBanner();
    });

    window.addEventListener('mouseup', () => {
      if (!this.isInteracting) return;
      this.isInteracting = false;
      this.finishMove();
    });

    // Touch Events (for mobile/tablet)
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.isGameOver || this.board.isAnimating) return;
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = getPos(e.touches[0]);
        this.isInteracting = this.connectionManager.handlePointerDown(pos.x, pos.y);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isInteracting || this.isGameOver || this.board.isAnimating) return;
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = getPos(e.touches[0]);
        this.connectionManager.handlePointerMove(pos.x, pos.y);
        this.updateLoopBanner();
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (!this.isInteracting) return;
      this.isInteracting = false;
      this.finishMove();
    });

    window.addEventListener('touchcancel', () => {
      if (!this.isInteracting) return;
      this.isInteracting = false;
      this.connectionManager.reset();
      this.loopBannerEl.classList.remove('show');
    });
  }

  private updateLoopBanner() {
    if (this.connectionManager.isLoop) {
      this.loopBannerEl.classList.add('show');
    } else {
      this.loopBannerEl.classList.remove('show');
    }
  }

  private finishMove() {
    this.loopBannerEl.classList.remove('show');
    const result = this.connectionManager.handlePointerUp();

    if (result.valid && result.clearedPositions.length > 0 && result.color) {
      // Audio feedback
      this.soundManager.playClearSound(result.isLoop);

      // Emit particles for each cleared dot
      for (const pos of result.clearedPositions) {
        const center = this.board.getCellCenter(pos.row, pos.col);
        this.particleSystem.emit(
          center.x,
          center.y,
          result.color,
          result.isLoop ? 12 : 8,
          result.isLoop ? 1.4 : 1
        );
      }

      // Remove dots from board and refill
      const { removedCount } = this.board.removeAndRefill(result.clearedPositions);

      // Award points: regular dots + bonus for loop
      const gainedScore = result.isLoop ? removedCount * 2 : removedCount;
      this.score += gainedScore;

      // Handle Moves mode
      if (this.mode === 'moves') {
        this.movesLeft--;
        if (this.movesLeft <= 0) {
          this.endGame();
        }
      }

      this.updateDashboard();
    }
  }

  public loop() {
    this.board.update();
    this.particleSystem.update();
    this.renderer.render();
    requestAnimationFrame(() => this.loop());
  }
}
