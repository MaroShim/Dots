import { PENTATONIC_SCALE } from '../constants';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private unlocked: boolean = false;
  private resumePromise: Promise<void> | null = null;

  constructor() {
    // Restore mute state preference
    try {
      this.isMuted = localStorage.getItem('dots_muted') === 'true';
    } catch {
      this.isMuted = false;
    }

    this.setupUnlockListeners();
  }

  /**
   * Browser Autoplay Policy & iOS WebKit require explicit user interaction to unlock AudioContext.
   * We attach capture-phase listeners on all pointer & touch events so the context awakens
   * before or simultaneously with the first in-game touch.
   */
  private setupUnlockListeners() {
    const unlock = () => {
      if (!this.ctx || this.ctx.state !== 'running') {
        this.unlockAudio();
      }
    };

    const unlockEvents = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
    });

    // Automatically resume context when returning to the app/tab from background
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
   * Lazily initialize AudioContext and master volume node
   */
  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (e) {
        console.warn('AudioContext creation failed:', e);
      }
    }
    return this.ctx;
  }

  /**
   * 1-sample buffer playback trick to awaken iOS WebKit audio pipeline
   */
  private playUnlockBuffer(ctx: AudioContext) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain ?? ctx.destination);
      source.start(0);
    } catch {}
  }

  /**
   * Unlocks and resumes AudioContext. Returns a Promise that resolves when the context
   * is guaranteed to be in 'running' state.
   */
  public unlockAudio(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve();

    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      if (!this.resumePromise) {
        this.resumePromise = ctx
          .resume()
          .then(() => {
            this.playUnlockBuffer(ctx);
            this.unlocked = true;
            this.resumePromise = null;
          })
          .catch((err) => {
            console.warn('AudioContext resume failed:', err);
            this.resumePromise = null;
          });
      }
      return this.resumePromise;
    } else {
      if (!this.unlocked) {
        this.playUnlockBuffer(ctx);
        this.unlocked = true;
      }
      return Promise.resolve();
    }
  }

  /**
   * Executes an audio action safely.
   * If AudioContext is already running, executes synchronously (zero latency).
   * If AudioContext is suspended, resumes it first and THEN executes action with the correct running currentTime,
   * completely eliminating dropped/silent initial notes on mobile browsers.
   */
  private runWithAudio(action: (ctx: AudioContext, destination: AudioNode) => void) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const dest = this.masterGain ?? ctx.destination;

    if (ctx.state === 'running') {
      action(ctx, dest);
    } else {
      this.unlockAudio().then(() => {
        if (this.ctx && this.ctx.state === 'running' && !this.isMuted) {
          action(this.ctx, this.masterGain ?? this.ctx.destination);
        }
      });
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('dots_muted', this.isMuted ? 'true' : 'false');
    } catch {}

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }

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
    this.runWithAudio((ctx, destination) => {
      const freqIndex = Math.min(stepIndex, PENTATONIC_SCALE.length - 1);
      const freq = PENTATONIC_SCALE[freqIndex];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.26);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * Sound when backtracking / unconnecting a dot
   */
  public playBacktrackTone() {
    this.runWithAudio((ctx, destination) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.11);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * Celebratory chord when a loop/square is formed
   */
  public playLoopSound() {
    this.runWithAudio((ctx, destination) => {
      // Play a bright Major Chord (C5, E5, G5, C6)
      const chord = [523.25, 659.25, 783.99, 1046.5];
      const now = ctx.currentTime;

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.001, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.04 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.45);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.46);

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
    this.runWithAudio((ctx, destination) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.36);

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
    this.runWithAudio((ctx, destination) => {
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.001, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.15);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.16);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
    });
  }

  /**
   * Play cascading tones when dots are shuffled
   */
  public playShuffleSound() {
    this.runWithAudio((ctx, destination) => {
      const notes = [329.63, 392.0, 523.25, 659.25, 783.99, 659.25, 523.25, 392.0];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.001, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.05 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.12);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.13);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
    });
  }

  /**
   * Sound when dots pop and disappear
   */
  public playClearSound(isSquare: boolean) {
    this.runWithAudio((ctx, destination) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSquare ? 650 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(isSquare ? 1200 : 880, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.16);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }
}
