import { PENTATONIC_SCALE } from '../constants';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private unlocked: boolean = false;

  constructor() {
    this.setupUnlockListeners();
  }

  /**
   * iOS WebKit requires an explicit user interaction to unlock AudioContext
   */
  private setupUnlockListeners() {
    const unlock = () => {
      this.unlockAudio();
      if (this.unlocked && this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('touchstart', unlock, true);
        window.removeEventListener('touchend', unlock, true);
        window.removeEventListener('click', unlock, true);
      }
    };

    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('touchend', unlock, true);
    window.addEventListener('click', unlock, true);
  }

  public unlockAudio() {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // Essential iOS buffer playback trick to awaken iOS audio pipeline
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);

      this.unlocked = true;
    } catch (e) {
      console.warn('Audio unlock failed:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.unlockAudio();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Plays note corresponding to connection step (higher pitch as path grows)
   */
  public playConnectTone(stepIndex: number) {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.ctx) return;

    const freqIndex = Math.min(stepIndex, PENTATONIC_SCALE.length - 1);
    const freq = PENTATONIC_SCALE[freqIndex];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Sound when backtracking / unconnecting a dot
   */
  public playBacktrackTone() {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Celebratory chord when a loop/square is formed
   */
  public playLoopSound() {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.ctx) return;

    // Play a bright Major Chord (C5, E5, G5, C6)
    const chord = [523.25, 659.25, 783.99, 1046.50];
    const now = this.ctx.currentTime;

    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.46);
    });
  }

  /**
   * Sound when dots pop and disappear
   */
  public playClearSound(isSquare: boolean) {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isSquare ? 650 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(isSquare ? 1200 : 880, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }
}
