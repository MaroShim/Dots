import { Dot, DotColor, GridPos } from './types';
import { GRID_SIZE, CANVAS_SIZE, DOT_COLORS } from '../constants';
import { easeOutBounce, easeOutCubic } from './easing';

export class Board {
  public grid: (Dot | null)[][] = [];
  public cellSize: number = 0;
  public startX: number = 0;
  public startY: number = 0;
  public dotRadius: number = 0;
  private nextId: number = 1;

  public canvasWidth: number = CANVAS_SIZE;
  public canvasHeight: number = CANVAS_SIZE;

  constructor() {
    this.setupMetrics(CANVAS_SIZE, CANVAS_SIZE);
    this.initGrid();
  }

  public setupMetrics(canvasWidth: number = CANVAS_SIZE, canvasHeight: number = CANVAS_SIZE) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    const padding = Math.min(canvasWidth, canvasHeight) * 0.08;
    const boardArea = Math.min(canvasWidth, canvasHeight) - padding * 2;
    this.cellSize = boardArea / GRID_SIZE;
    this.dotRadius = this.cellSize * 0.28;
    this.startX = (canvasWidth - boardArea) / 2 + this.cellSize / 2;
    this.startY = (canvasHeight - boardArea) / 2 + this.cellSize / 2;
  }

  public initGrid() {
    this.grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = this.getRandomColor();
        const center = this.getCellCenter(r, c);
        this.grid[r][c] = {
          id: this.nextId++,
          row: r,
          col: c,
          x: center.x,
          y: center.y,
          targetX: center.x,
          targetY: center.y,
          color,
          scale: 1,
          alpha: 1,
          isRemoving: false
        };
      }
    }
  }

  public resize(canvasWidth: number = CANVAS_SIZE, canvasHeight: number = CANVAS_SIZE) {
    this.setupMetrics(canvasWidth, canvasHeight);

    // Safe guard: only reposition dots if grid has been initialized
    if (!this.grid || this.grid.length !== GRID_SIZE) return;

    for (let r = 0; r < GRID_SIZE; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < GRID_SIZE; c++) {
        const dot = this.grid[r][c];
        if (dot) {
          const target = this.getCellCenter(r, c);
          dot.targetX = target.x;
          dot.targetY = target.y;
          if ((dot.x === 0 && dot.y === 0) || !this.isAnimating) {
            dot.x = target.x;
            dot.y = target.y;
          }
        }
      }
    }
  }

  public getCellCenter(row: number, col: number): { x: number; y: number } {
    return {
      x: this.startX + col * this.cellSize,
      y: this.startY + row * this.cellSize
    };
  }

  public getDotAt(row: number, col: number): Dot | null {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    return this.grid[row][col];
  }

  public getRandomColor(): DotColor {
    return DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  }

  /**
   * Clears dots at specified positions and applies gravity & replenishes with new dots
   */
  public removeAndRefill(dotsToRemove: GridPos[]): { removedCount: number; removedDots: Dot[] } {
    const removedDots: Dot[] = [];

    // Mark as null
    for (const pos of dotsToRemove) {
      const dot = this.grid[pos.row][pos.col];
      if (dot) {
        removedDots.push({ ...dot });
        this.grid[pos.row][pos.col] = null;
      }
    }

    // Apply gravity column by column
    for (let c = 0; c < GRID_SIZE; c++) {
      let emptyRow = GRID_SIZE - 1;

      // Drop existing dots down
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== emptyRow) {
            const dot = this.grid[r][c]!;
            this.grid[emptyRow][c] = dot;
            this.grid[r][c] = null;
            dot.row = emptyRow;
            dot.col = c;
            const target = this.getCellCenter(emptyRow, c);
            dot.targetX = target.x;
            dot.targetY = target.y;
          }
          emptyRow--;
        }
      }

      // Fill remaining empty cells from top
      let spawnOffset = 1;
      for (let r = emptyRow; r >= 0; r--) {
        const target = this.getCellCenter(r, c);
        const color = this.getRandomColor();
        const newDot: Dot = {
          id: this.nextId++,
          row: r,
          col: c,
          x: target.x,
          // Spawn above visible canvas for falling effect
          y: target.y - spawnOffset * this.cellSize * 1.5,
          targetX: target.x,
          targetY: target.y,
          color,
          scale: 1,
          alpha: 1,
          isRemoving: false
        };
        this.grid[r][c] = newDot;
        spawnOffset++;
      }
    }

    return { removedCount: removedDots.length, removedDots };
  }

  /**
   * Finds all dots matching a specific color (used when a Square loop is cleared)
   */
  public getAllDotsOfColor(color: DotColor): GridPos[] {
    const list: GridPos[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const dot = this.grid[r][c];
        if (dot && dot.color === color) {
          list.push({ row: r, col: c });
        }
      }
    }
    return list;
  }

  public isFallingOut: boolean = false;
  public isFallingIn: boolean = false;
  private animStartTime: number = 0;
  private fallOutDuration: number = 1000; // 1 second as requested
  private fallInDuration: number = 650; // ms
  private activeFallDots: { dot: Dot; startY: number; destY: number; delay: number }[] = [];
  private onAnimComplete?: () => void;

  /**
   * Toggle bounce physics on fall-in (true = bounce, false = smooth deceleration)
   */
  public enableBounce: boolean = false;

  public setBounceEnabled(enabled: boolean) {
    this.enableBounce = enabled;
  }

  public get isAnimating(): boolean {
    return this.isFallingOut || this.isFallingIn;
  }

  /**
   * Called when game ends: drops all dots off the bottom over 1.0s, leaving the board empty.
   */
  public startFallOut(onComplete?: () => void) {
    this.isFallingOut = true;
    this.isFallingIn = false;
    this.animStartTime = performance.now();
    this.onAnimComplete = onComplete;
    this.activeFallDots = [];

    const bottomY = (this.canvasHeight || 440) + this.cellSize * 2.2;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        let dot = this.grid[r][c];
        if (!dot) {
          const center = this.getCellCenter(r, c);
          dot = {
            id: this.nextId++,
            row: r,
            col: c,
            x: center.x,
            y: center.y,
            targetX: center.x,
            targetY: center.y,
            color: this.getRandomColor(),
            scale: 1,
            alpha: 1,
            isRemoving: false
          };
          this.grid[r][c] = dot;
        }

        // Waterfall cascade delay: lower rows start falling first
        const delay = (GRID_SIZE - 1 - r) * 50 + ((c + r) % 3) * 30;
        this.activeFallDots.push({
          dot,
          startY: dot.y,
          destY: bottomY + (GRID_SIZE - r) * this.cellSize * 0.5,
          delay
        });
      }
    }
  }

  /**
   * Called when restarting the game: spawns new dots from above and drops them in.
   */
  public startFallIn(onComplete?: () => void) {
    this.isFallingIn = true;
    this.isFallingOut = false;
    this.fallInDuration = this.enableBounce ? 650 : 450;
    this.animStartTime = performance.now();
    this.onAnimComplete = onComplete;
    this.activeFallDots = [];

    // Clear and create 36 completely fresh dots
    this.grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const target = this.getCellCenter(r, c);
        const color = this.getRandomColor();

        // Spawn above the canvas top edge
        const startY = -this.cellSize * (GRID_SIZE - r) * 1.5 - (c % 2) * 25;

        const newDot: Dot = {
          id: this.nextId++,
          row: r,
          col: c,
          x: target.x,
          y: startY,
          targetX: target.x,
          targetY: target.y,
          color,
          scale: 1,
          alpha: 1,
          isRemoving: false
        };

        this.grid[r][c] = newDot;

        // Cascade delay so top ones drop in sequentially
        const delay = r * 35 + (c % 3) * 20;
        this.activeFallDots.push({
          dot: newDot,
          startY,
          destY: target.y,
          delay
        });
      }
    }
  }

  /**
   * Smooth physics / easing animation update for dots
   */
  public update() {
    const now = performance.now();

    // 1. Fall Out: Dots fall off bottom over 1.0s
    if (this.isFallingOut) {
      const elapsed = now - this.animStartTime;
      let allDone = true;

      for (const item of this.activeFallDots) {
        if (elapsed < item.delay) {
          allDone = false;
          continue;
        }
        const effectiveDuration = Math.max(100, this.fallOutDuration - item.delay);
        const p = Math.min(1, (elapsed - item.delay) / effectiveDuration);
        
        // Accelerated gravity curve
        item.dot.y = item.startY + (item.destY - item.startY) * (p * p);
        if (p < 1) allDone = false;
      }

      if (allDone || elapsed >= this.fallOutDuration) {
        this.isFallingOut = false;
        // Board is now completely empty!
        this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        this.activeFallDots = [];
        if (this.onAnimComplete) {
          const cb = this.onAnimComplete;
          this.onAnimComplete = undefined;
          cb();
        }
      }
      return;
    }

    // 2. Fall In: Fresh dots rain down from top and bounce settle
    if (this.isFallingIn) {
      const elapsed = now - this.animStartTime;
      let allDone = true;

      for (const item of this.activeFallDots) {
        if (elapsed < item.delay) {
          allDone = false;
          continue;
        }
        const effectiveDuration = Math.max(100, this.fallInDuration - item.delay);
        const p = Math.min(1, (elapsed - item.delay) / effectiveDuration);

        // Easing: bounce when enabled, otherwise smooth cubic deceleration
        const eased = this.enableBounce ? easeOutBounce(p) : easeOutCubic(p);
        item.dot.y = item.startY + (item.destY - item.startY) * eased;
        if (p < 1) allDone = false;
      }

      if (allDone || elapsed >= this.fallInDuration) {
        this.isFallingIn = false;
        for (const item of this.activeFallDots) {
          item.dot.y = item.destY;
        }
        this.activeFallDots = [];
        if (this.onAnimComplete) {
          const cb = this.onAnimComplete;
          this.onAnimComplete = undefined;
          cb();
        }
      }
      return;
    }

    // 3. Normal gravity drop during standard play
    const lerpFactor = 0.28;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const dot = this.grid[r][c];
        if (dot) {
          dot.y += (dot.targetY - dot.y) * lerpFactor;
          dot.x += (dot.targetX - dot.x) * lerpFactor;

          if (Math.abs(dot.y - dot.targetY) < 0.2) dot.y = dot.targetY;
          if (Math.abs(dot.x - dot.targetX) < 0.2) dot.x = dot.targetX;
        }
      }
    }
  }
}


