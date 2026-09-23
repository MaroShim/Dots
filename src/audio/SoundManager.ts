import { PENTATONIC_SCALE } from '../constants';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check saved mute preference
    try {
      const saved = localStorage.getItem('dots_muted');
      this.isMuted = saved === 'true';
    } catch {
      this.isMuted = false;
    }

    this.setupUnlockListeners();
  }

  /**
   * Lazily initialize AudioContext
   */
  public ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        console.warn('[Dots Audio] Context creation failed:', e);
      }
    }
    return this.ctx;
  }

  /**
   * Global listeners attached in capture phase to unlock audio on user interaction
   */
  private setupUnlockListeners() {
    const unlock = () => {
      this.unlockAudio();
    };

    const unlockEvents = ['touchstart', 'touchend', 'click', 'pointerdown', 'mousedown', 'keydown'];
    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
    });

    // Automatically resume context when returning to the app from background
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
    });

    window.addEventListener('focus', () => {
      if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  /**
   * Unlocks and resumes AudioContext in direct response to a user gesture.
   */
  public unlockAudio(): Promise<AudioContext | null> {
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve(null);

    // Modern WebKit AudioSession API (iOS 16.4+)
    if ('audioSession' in navigator) {
      try {
        (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback';
      } catch {}
    }

    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      return ctx
        .resume()
        .then(() => ctx)
        .catch(() => ctx);
    }

    return Promise.resolve(ctx);
  }

  /**
   * Executes an audio action safely.
   */
  private runWithAudio(action: (ctx: AudioContext) => void) {
    if (this.isMuted) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'running') {
      try {
        action(ctx);
      } catch (err) {
        console.warn('[Dots Audio] Playback error:', err);
      }
    } else {
      this.unlockAudio().then((activeCtx) => {
        if (activeCtx && !this.isMuted) {
          try {
            action(activeCtx);
          } catch (err) {
            console.warn('[Dots Audio] Playback error:', err);
          }
        }
      });
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('dots_muted', this.isMuted ? 'true' : 'false');
    } catch {}

    if (!this.isMuted) {
      this.unlockAudio().then((ctx) => {
        if (ctx) {
          this.playTestChime();
        }
      });
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Test chime played when user turns on sound
   */
  public playTestChime() {
    this.runWithAudio((ctx) => {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const startTime = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.23);
      });
    });
  }

  /**
   * Plays a warm, soft, elegant tone for connection step (original Dots feel)
   */
  public playConnectTone(stepIndex: number) {
    this.runWithAudio((ctx) => {
      const freqIndex = Math.min(stepIndex, PENTATONIC_SCALE.length - 1);
      const freq = PENTATONIC_SCALE[freqIndex];
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    });
  }

  /**
   * Sound when backtracking / unconnecting a dot
   */
  public playBacktrackTone() {
    this.runWithAudio((ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    });
  }

  /**
   * Celebratory chord when a loop/square is formed (Major Chord C5, E5, G5, C6)
   */
  public playLoopSound() {
    this.runWithAudio((ctx) => {
      const chord = [523.25, 659.25, 783.99, 1046.5];
      const now = ctx.currentTime;

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const startTime = now + idx * 0.04;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.16, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.36);
      });
    });
  }

  /**
   * Sound when dots tumble down out of the board on reset
   */
  public playFallOutSound() {
    this.runWithAudio((ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.32);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.33);
    });
  }

  /**
   * Cascading rain sound when new dots drop into the board
   */
  public playFallInSound() {
    this.runWithAudio((ctx) => {
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const startTime = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.14, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.19);
      });
    });
  }

  /**
   * Cascading tones when dots are shuffled
   */
  public playShuffleSound() {
    this.runWithAudio((ctx) => {
      const notes = [329.63, 392.0, 523.25, 659.25, 783.99, 659.25, 523.25, 392.0];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const startTime = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.14, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.17);
      });
    });
  }

  /**
   * Pop/burst sound when dots are cleared
   */
  public playClearSound(isSquare: boolean) {
    this.runWithAudio((ctx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSquare ? 650 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(isSquare ? 1200 : 880, now + 0.1);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    });
  }
}
