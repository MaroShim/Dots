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

  /**
   * Smooth physics / easing animation update for dots
   */
  public update() {
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
