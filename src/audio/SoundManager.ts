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
   * Global listeners attached in capture phase to unlock audio on the very first user interaction
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

    // Try WebKit AudioSession API for iOS 16.4+
    if ('audioSession' in navigator) {
      try {
        (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback';
      } catch {}
    }

    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      return ctx
        .resume()
        .then(() => {
          return ctx;
        })
        .catch(() => {
          return ctx;
        });
    }

    return Promise.resolve(ctx);
  }

  /**
   * Executes an audio action safely.
   * If AudioContext is already running, executes synchronously.
   * If AudioContext is suspended, resumes it first and THEN plays.
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
          // Play a cheerful confirmation chime (C5, E5, G5) when unmuted
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

        osc.type = 'triangle';
        const startTime = now + idx * 0.06;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.26);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
    });
  }

  /**
   * Plays a warm, rich wooden marimba tone for connection step
   */
  public playConnectTone(stepIndex: number) {
    this.runWithAudio((ctx) => {
      const freqIndex = Math.min(stepIndex, PENTATONIC_SCALE.length - 1);
      const freq = PENTATONIC_SCALE[freqIndex];
      const now = ctx.currentTime;

      // 1. Primary Marimba Body (Triangle wave for rich odd harmonics)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.31);

      // 2. Chime Overtone (Sine at 2x frequency for bell-like sparkle)
      const overtone = ctx.createOscillator();
      const overGain = ctx.createGain();

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, now);

      overGain.gain.setValueAtTime(0.001, now);
      overGain.gain.linearRampToValueAtTime(0.12, now + 0.005);
      overGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      overtone.connect(overGain);
      overGain.connect(ctx.destination);

      overtone.start(now);
      overtone.stop(now + 0.17);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        overtone.disconnect();
        overGain.disconnect();
      };
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

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
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

        osc.type = 'triangle';
        const startTime = now + idx * 0.035;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.52);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
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

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.38);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.39);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
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

        osc.type = 'triangle';
        const startTime = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.23);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
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

        osc.type = 'triangle';
        const startTime = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.17);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
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
      osc.frequency.setValueAtTime(isSquare ? 600 : 420, now);
      osc.frequency.exponentialRampToValueAtTime(isSquare ? 1300 : 920, now + 0.12);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }
}
