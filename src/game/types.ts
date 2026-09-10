export type GameMode = 'timed' | 'moves' | 'endless';

export type DotColor = '#EA4335' | '#4285F4' | '#34A853' | '#FBBC05' | '#9C27B0';

export interface Dot {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: DotColor;
  scale: number;
  alpha: number;
  isRemoving: boolean;
}

export interface GridPos {
  row: number;
  col: number;
}
