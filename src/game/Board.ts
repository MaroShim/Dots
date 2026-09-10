import { Dot, DotColor, GridPos } from './types';
import { GRID_SIZE, DOT_COLORS } from '../constants';

export class Board {
  public grid: (Dot | null)[][] = [];
  public cellSize: number = 0;
  public startX: number = 0;
  public startY: number = 0;
  public dotRadius: number = 0;
  private nextId: number = 1;

  public canvasWidth: number = 0;
  public canvasHeight: number = 0;

  constructor() {
    this.initGrid();
  }

  public initGrid() {
    this.grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = this.getRandomColor();
        this.grid[r][c] = {
          id: this.nextId++,
          row: r,
          col: c,
          x: 0,
          y: 0,
          targetX: 0,
          targetY: 0,
          color,
          scale: 1,
          alpha: 1,
          isRemoving: false
        };
      }
    }
  }

  public resize(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Leave safe margins
    const padding = Math.min(canvasWidth, canvasHeight) * 0.08;
    const boardArea = Math.min(canvasWidth, canvasHeight) - padding * 2;
    this.cellSize = boardArea / GRID_SIZE;
    this.dotRadius = this.cellSize * 0.28;
    this.startX = (canvasWidth - boardArea) / 2 + this.cellSize / 2;
    this.startY = (canvasHeight - boardArea) / 2 + this.cellSize / 2;

    // Reposition all existing dots
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const dot = this.grid[r][c];
        if (dot) {
          const target = this.getCellCenter(r, c);
          dot.targetX = target.x;
          dot.targetY = target.y;
          // If first run, set current x, y directly
          if (dot.x === 0 && dot.y === 0) {
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

  public isGravityResetting: boolean = false;
  private gravityPhase: 'idle' | 'falling_out' | 'falling_in' = 'idle';
  private gravityStartTime: number = 0;
  private readonly fallOutDuration: number = 680; // ms: ample time to clearly see dots tumble down
  private readonly fallInDuration: number = 750; // ms: smooth bounce rain-in
  private fallOutDots: { dot: Dot; startY: number; destY: number; delay: number }[] = [];
  private fallInDots: { dot: Dot; startY: number; destY: number; delay: number }[] = [];
  private onGravityComplete?: () => void;
  private onFallInCallback?: () => void;

  /**
   * Drops all existing dots off the bottom of the screen with gravity,
   * then rains down fresh dots with bounce settling.
   */
  public startGravityReset(onComplete?: () => void, onFallIn?: () => void) {
    this.isGravityResetting = true;
    this.gravityPhase = 'falling_out';
    this.gravityStartTime = performance.now();
    this.onGravityComplete = onComplete;
    this.onFallInCallback = onFallIn;
    this.fallOutDots = [];

    const bottomY = (this.canvasHeight || 440) + this.cellSize * 2.0;

    // Gather existing dots to drop down
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

        // Bottom rows drop first, creating an opening bottom waterfall effect
        const delay = (GRID_SIZE - 1 - r) * 35 + ((c + r) % 3) * 20;
        this.fallOutDots.push({
          dot,
          startY: dot.y,
          destY: bottomY + (GRID_SIZE - r) * this.cellSize * 0.4,
          delay
        });
      }
    }
  }

  private prepareFallIn() {
    this.gravityPhase = 'falling_in';
    this.gravityStartTime = performance.now();
    this.fallInDots = [];

    // Clear and create 36 fresh dots
    this.grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const target = this.getCellCenter(r, c);
        const color = this.getRandomColor();

        // Spawn high above the canvas ceiling
        const startY = -this.cellSize * (GRID_SIZE - r) * 1.8 - (c % 2) * 30;

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

        // Cascade delay so top drops in staggered wave
        const delay = r * 35 + (c % 3) * 25;
        this.fallInDots.push({
          dot: newDot,
          startY,
          destY: target.y,
          delay
        });
      }
    }

    if (this.onFallInCallback) {
      this.onFallInCallback();
    }
  }

  /**
   * Smooth physics / easing animation update for dots
   */
  public update() {
    // 1. Gravity Reset Animation (Fall out & Rain in)
    if (this.isGravityResetting) {
      const now = performance.now();
      const elapsed = now - this.gravityStartTime;

      if (this.gravityPhase === 'falling_out') {
        let allDone = true;
        for (const item of this.fallOutDots) {
          if (elapsed < item.delay) {
            allDone = false;
            continue;
          }
          const p = Math.min(1, (elapsed - item.delay) / (this.fallOutDuration - item.delay));
          // Ease-in quadratic (gravity acceleration down)
          item.dot.y = item.startY + (item.destY - item.startY) * (p * p);
          if (p < 1) allDone = false;
        }

        if (allDone || elapsed >= this.fallOutDuration) {
          // Switch to raining in fresh dots!
          this.prepareFallIn();
        }
        return;
      }

      if (this.gravityPhase === 'falling_in') {
        let allDone = true;
        for (const item of this.fallInDots) {
          if (elapsed < item.delay) {
            allDone = false;
            continue;
          }
          const p = Math.min(1, (elapsed - item.delay) / (this.fallInDuration - item.delay));
          // Ease-out bounce landing
          item.dot.y = item.startY + (item.destY - item.startY) * easeOutBounce(p);
          if (p < 1) allDone = false;
        }

        if (allDone || elapsed >= this.fallInDuration) {
          this.isGravityResetting = false;
          this.gravityPhase = 'idle';
          for (const item of this.fallInDots) {
            item.dot.y = item.destY;
          }
          if (this.onGravityComplete) {
            this.onGravityComplete();
            this.onGravityComplete = undefined;
          }
        }
        return;
      }
    }

    // 2. Normal gravity drop for standard gameplay
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

function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    const t = x - 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (x < 2.5 / d1) {
    const t = x - 2.25 / d1;
    return n1 * t * t + 0.9375;
  } else {
    const t = x - 2.625 / d1;
    return n1 * t * t + 0.984375;
  }
}


