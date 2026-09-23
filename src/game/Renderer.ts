import { Board } from './Board';
import { ConnectionManager } from './ConnectionManager';
import { ParticleSystem } from './ParticleSystem';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr: number = window.devicePixelRatio || 1;
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
  }

  public resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 10 || rect.height <= 10) return;

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.board.resize(rect.width, rect.height);
  }

  public render() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width <= 10 || height <= 10) return;

    // Self-healing: if layout changed or was initialized at 0, resize immediately
    const expectedWidth = Math.round(width * this.dpr);
    const expectedHeight = Math.round(height * this.dpr);
    if (this.canvas.width !== expectedWidth || this.canvas.height !== expectedHeight || this.board.cellSize <= 0) {
      this.resize();
    }

    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.clearRect(0, 0, width, height);

    this.pulsePhase += 0.08;

    // 1. Draw Loop Background Flash if a closed loop / square is active
    if (this.connectionManager.isLoop && this.connectionManager.currentColor) {
      this.ctx.save();
      this.ctx.fillStyle = this.connectionManager.currentColor;
      this.ctx.globalAlpha = 0.08 + Math.sin(this.pulsePhase) * 0.03;
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();
    }

    // 2. Draw Connection Lines
    this.renderConnectionLines();

    // 3. Draw Dots
    this.renderDots();

    // 4. Draw Particles
    this.particleSystem.render(this.ctx);

    this.ctx.restore();
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

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
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
