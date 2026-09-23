import { Board } from './Board';
import { ConnectionManager } from './ConnectionManager';
import { ParticleSystem } from './ParticleSystem';
import { CANVAS_SIZE, GRID_SIZE } from '../constants';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private pulsePhase: number = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private board: Board,
    private connectionManager: ConnectionManager,
    private particleSystem: ParticleSystem
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;

    // Fixed internal resolution guarantees zero DPR distortion
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
    this.board.resize(CANVAS_SIZE, CANVAS_SIZE);
  }

  public resize() {
    // Keep internal buffer firmly at high-res CANVAS_SIZE
    if (this.canvas.width !== CANVAS_SIZE || this.canvas.height !== CANVAS_SIZE) {
      this.canvas.width = CANVAS_SIZE;
      this.canvas.height = CANVAS_SIZE;
    }
    this.board.resize(CANVAS_SIZE, CANVAS_SIZE);
  }

  public render() {
    this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    this.pulsePhase += 0.08;

    // 1. Draw Loop Background Flash if a closed loop / square is active
    if (this.connectionManager.isLoop && this.connectionManager.currentColor) {
      this.ctx.save();
      this.ctx.fillStyle = this.connectionManager.currentColor;
      this.ctx.globalAlpha = 0.08 + Math.sin(this.pulsePhase) * 0.03;
      this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      this.ctx.restore();
    }

    // 2. Draw Connection Lines
    this.renderConnectionLines();

    // 3. Draw Dots
    this.renderDots();

    // 4. Draw Particles
    this.particleSystem.render(this.ctx);
  }

  private renderConnectionLines() {
    const path = this.connectionManager.currentPath;
    const color = this.connectionManager.currentColor;
    if (path.length === 0 || !color) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.board.dotRadius * 1.05;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    const firstPos = this.board.getCellCenter(path[0].row, path[0].col);
    this.ctx.moveTo(firstPos.x, firstPos.y);

    for (let i = 1; i < path.length; i++) {
      const pos = this.board.getCellCenter(path[i].row, path[i].col);
      this.ctx.lineTo(pos.x, pos.y);
    }

    // If still dragging and not completed loop, line to current pointer
    if (this.connectionManager.currentPointer && !this.connectionManager.isLoop) {
      this.ctx.lineTo(
        this.connectionManager.currentPointer.x,
        this.connectionManager.currentPointer.y
      );
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderDots() {
    const connectedSet = new Set<string>();
    for (const p of this.connectionManager.currentPath) {
      connectedSet.add(`${p.row},${p.col}`);
    }

    const isLoopActive = this.connectionManager.isLoop;
    const activeColor = this.connectionManager.currentColor;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const dot = this.board.getDotAt(r, c);
        if (!dot) continue;

        const isConnected = connectedSet.has(`${r},${c}`);
        const isMatchingLoopColor = isLoopActive && dot.color === activeColor;

        this.ctx.save();
        this.ctx.fillStyle = dot.color;
        this.ctx.globalAlpha = dot.alpha;

        let scale = dot.scale;
        if (isConnected) {
          scale = 1.18;
        } else if (isMatchingLoopColor) {
          scale = 1.1 + Math.sin(this.pulsePhase + (r + c) * 0.5) * 0.08;
        }

        const radius = this.board.dotRadius * scale;

        // Draw dot circle
        this.ctx.beginPath();
        this.ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // If loop active, draw an elegant subtle ring around affected dots
        if (isMatchingLoopColor) {
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.arc(dot.x, dot.y, radius - 1, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        this.ctx.restore();
      }
    }
  }
}
