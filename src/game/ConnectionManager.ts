import { Board } from './Board';
import { DotColor, GridPos } from './types';
import { GRID_SIZE } from '../constants';
import { SoundManager } from '../audio/SoundManager';

export interface ConnectionResult {
  valid: boolean;
  isLoop: boolean;
  color: DotColor | null;
  clearedPositions: GridPos[];
}

export class ConnectionManager {
  public currentPath: GridPos[] = [];
  public currentColor: DotColor | null = null;
  public isLoop: boolean = false;
  public currentPointer: { x: number; y: number } | null = null;

  constructor(
    private board: Board,
    private soundManager: SoundManager
  ) {}

  /**
   * Translates pointer coordinates to a grid position if inside a dot's hit area
   */
  public getGridPosFromCoords(x: number, y: number): GridPos | null {
    const hitRadius = this.board.cellSize * 0.44; // Generous hit area for mobile/mouse

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const center = this.board.getCellCenter(r, c);
        const dist = Math.hypot(x - center.x, y - center.y);
        if (dist <= hitRadius) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  public handlePointerDown(x: number, y: number): boolean {
    this.currentPath = [];
    this.currentColor = null;
    this.isLoop = false;
    this.currentPointer = { x, y };

    const pos = this.getGridPosFromCoords(x, y);
    if (pos) {
      const dot = this.board.getDotAt(pos.row, pos.col);
      if (dot) {
        this.currentPath.push(pos);
        this.currentColor = dot.color;
        this.soundManager.playConnectTone(0);
        return true;
      }
    }
    return false;
  }

  public handlePointerMove(x: number, y: number) {
    this.currentPointer = { x, y };
    if (this.currentPath.length === 0 || !this.currentColor) return;

    const hitPos = this.getGridPosFromCoords(x, y);
    if (!hitPos) return;

    const lastPos = this.currentPath[this.currentPath.length - 1];

    // Already on the same dot as last connected
    if (hitPos.row === lastPos.row && hitPos.col === lastPos.col) return;

    // Check Backtracking (user drags back to the second-to-last dot to undo)
    if (this.currentPath.length >= 2) {
      const secondLastPos = this.currentPath[this.currentPath.length - 2];
      if (hitPos.row === secondLastPos.row && hitPos.col === secondLastPos.col) {
        this.currentPath.pop();
        // If we were in loop state and just popped the closing connection
        this.checkIfStillLoop();
        this.soundManager.playBacktrackTone();
        return;
      }
    }

    // Must be orthogonally adjacent (Up, Down, Left, Right)
    const rowDiff = Math.abs(hitPos.row - lastPos.row);
    const colDiff = Math.abs(hitPos.col - lastPos.col);
    const isAdjacent = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    if (!isAdjacent) return;

    // Must be same color
    const dot = this.board.getDotAt(hitPos.row, hitPos.col);
    if (!dot || dot.color !== this.currentColor) return;

    // Check for Loop (Closing a cycle / Square)
    const existingIndex = this.currentPath.findIndex(
      p => p.row === hitPos.row && p.col === hitPos.col
    );

    if (existingIndex !== -1) {
      // Loop formed! Can only form if path length >= 4 (e.g. 2x2 square has 4 dots)
      if (this.currentPath.length >= 4 && !this.isLoop) {
        this.currentPath.push(hitPos);
        this.isLoop = true;
        this.soundManager.playLoopSound();
      }
    } else {
      // Normal connection
      if (!this.isLoop) {
        this.currentPath.push(hitPos);
        this.soundManager.playConnectTone(this.currentPath.length - 1);
      }
    }
  }

  private checkIfStillLoop() {
    // Check if any position appears more than once in the path
    const set = new Set<string>();
    let hasDuplicate = false;
    for (const p of this.currentPath) {
      const key = `${p.row},${p.col}`;
      if (set.has(key)) {
        hasDuplicate = true;
        break;
      }
      set.add(key);
    }
    this.isLoop = hasDuplicate;
  }

  public handlePointerUp(): ConnectionResult {
    const valid = this.currentPath.length >= 2;
    const wasLoop = this.isLoop;
    const color = this.currentColor;
    let clearedPositions: GridPos[] = [];

    if (valid && color) {
      if (wasLoop) {
        // Clear all dots of this color on the whole board!
        clearedPositions = this.board.getAllDotsOfColor(color);
      } else {
        // Clear only the connected dots (deduplicated)
        const seen = new Set<string>();
        for (const p of this.currentPath) {
          const key = `${p.row},${p.col}`;
          if (!seen.has(key)) {
            seen.add(key);
            clearedPositions.push(p);
          }
        }
      }
    }

    // Reset interaction state
    this.currentPath = [];
    this.currentColor = null;
    this.isLoop = false;
    this.currentPointer = null;

    return {
      valid,
      isLoop: wasLoop,
      color,
      clearedPositions
    };
  }

  public reset() {
    this.currentPath = [];
    this.currentColor = null;
    this.isLoop = false;
    this.currentPointer = null;
  }
}
