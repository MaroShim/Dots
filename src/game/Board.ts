import { Dot, DotColor, GridPos } from './types';
import { GRID_SIZE, DOT_COLORS } from '../constants';

export class Board {
  public grid: (Dot | null)[][] = [];
  public cellSize: number = 0;
  public startX: number = 0;
  public startY: number = 0;
  public dotRadius: number = 0;
  private nextId: number = 1;

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

  public isShuffling: boolean = false;
  private shuffleStartTime: number = 0;
  private shuffleDuration: number = 700; // ms
  private shuffleStates: {
    dot: Dot;
    startX: number;
    startY: number;
    destX: number;
    destY: number;
    midX: number;
    midY: number;
  }[] = [];
  private onShuffleComplete?: () => void;

  /**
   * Shuffles all dots on the board with an arc/swirl animation
   */
  public startShuffle(onComplete?: () => void) {
    this.isShuffling = true;
    this.shuffleStartTime = performance.now();
    this.onShuffleComplete = onComplete;
    this.shuffleStates = [];

    // Ensure all grid cells have dots
    const dots: Dot[] = [];
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
        dots.push(dot);
      }
    }

    // Generate randomized target grid positions (Fisher-Yates)
    const positions: GridPos[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        positions.push({ row: r, col: c });
      }
    }
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Center of board
    const centerX = this.startX + (GRID_SIZE - 1) * this.cellSize * 0.5;
    const centerY = this.startY + (GRID_SIZE - 1) * this.cellSize * 0.5;

    // Reset logical grid mapping
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

    // Assign new positions and fresh randomized colors
    dots.forEach((dot, idx) => {
      const newPos = positions[idx];
      const targetCenter = this.getCellCenter(newPos.row, newPos.col);

      const startX = dot.x;
      const startY = dot.y;
      const destX = targetCenter.x;
      const destY = targetCenter.y;

      dot.row = newPos.row;
      dot.col = newPos.col;
      dot.targetX = destX;
      dot.targetY = destY;
      dot.color = this.getRandomColor(); // Completely fresh colors
      this.grid[newPos.row][newPos.col] = dot;

      // Calculate a curved midpoint swinging around center for swirl effect
      const midPointX = (startX + destX) * 0.5;
      const midPointY = (startY + destY) * 0.5;
      const dx = midPointX - centerX;
      const dy = midPointY - centerY;
      // Perpendicular swirl offset
      const swirlFactor = 0.6;
      const midX = midPointX - dy * swirlFactor;
      const midY = midPointY + dx * swirlFactor;

      this.shuffleStates.push({
        dot,
        startX,
        startY,
        destX,
        destY,
        midX,
        midY
      });
    });
  }

  /**
   * Smooth physics / easing animation update for dots
   */
  public update() {
    if (this.isShuffling) {
      const elapsed = performance.now() - this.shuffleStartTime;
      const progress = Math.min(1, elapsed / this.shuffleDuration);

      // Smooth Ease-In-Out Quintic / Cubic
      const t = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      for (const s of this.shuffleStates) {
        // Quadratic Bezier interpolation for curved trajectory
        const invT = 1 - t;
        s.dot.x = invT * invT * s.startX + 2 * invT * t * s.midX + t * t * s.destX;
        s.dot.y = invT * invT * s.startY + 2 * invT * t * s.midY + t * t * s.destY;
      }

      if (progress >= 1) {
        this.isShuffling = false;
        for (const s of this.shuffleStates) {
          s.dot.x = s.destX;
          s.dot.y = s.destY;
        }
        if (this.onShuffleComplete) {
          this.onShuffleComplete();
          this.onShuffleComplete = undefined;
        }
      }
      return;
    }

    const lerpFactor = 0.28; // Smooth gravity drop
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const dot = this.grid[r][c];
        if (dot) {
          // Animate Y towards targetY
          dot.y += (dot.targetY - dot.y) * lerpFactor;
          dot.x += (dot.targetX - dot.x) * lerpFactor;

          // If very close, snap to target
          if (Math.abs(dot.y - dot.targetY) < 0.2) dot.y = dot.targetY;
          if (Math.abs(dot.x - dot.targetX) < 0.2) dot.x = dot.targetX;
        }
      }
    }
  }
}

