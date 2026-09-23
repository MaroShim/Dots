/**
 * Easing functions for smooth animations
 */

export function easeOutBounce(x: number): number {
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

export function easeInQuad(x: number): number {
  return x * x;
}
