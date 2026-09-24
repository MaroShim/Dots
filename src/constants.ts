import { DotColor } from './game/types';

export const GRID_SIZE = 6;
export const CANVAS_SIZE = 600;

export const DOT_COLORS: DotColor[] = [
  '#EA4335', // Red
  '#00A0FF', // Vibrant Sky Blue
  '#2E7D32', // Forest Green
  '#FBBC05', // Yellow
  '#9C27B0'  // Purple
];

export const TIMED_INITIAL_SECONDS = 60;
export const MOVES_INITIAL_COUNT = 30;

// C Major Pentatonic Scale frequencies (Hz) for harmonious connection sounds
export const PENTATONIC_SCALE = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  1046.50 // C6
];
