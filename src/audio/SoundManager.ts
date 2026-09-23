import { PENTATONIC_SCALE } from '../constants';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private unlocked: boolean = false;
  private resumePromise: Promise<void> | null = null;
  private silentAudioEl: HTMLAudioElement | null = null;

  constructor() {
    // Restore mute state preference (default is unmuted: false)
    try {
      const saved = localStorage.getItem('dots_muted');
      this.isMuted = saved === 'true';
    } catch {
      this.isMuted = false;
    }

    this.setupUnlockListeners();
  }

  /**
   * Bypasses the iOS physical Silent/Mute switch and ensures the Web Audio API
   * is fully unlocked on iOS Safari and modern mobile browsers.
   */
  private unlockiOSAudio() {
    // 1. Modern WebKit AudioSession API (iOS 16.4+)
    if ('audioSession' in navigator) {
      try {
        (navigator as any).audioSession.type = 'playback';
      } catch {}
    }

    // 2. Play a microscopic silent HTML5 <audio> element.
    // This forces iOS WebKit's audio session category to transition from "ambient" to "playback",
    // allowing Web Audio API sounds to play through device speakers even if the hardware mute switch is active!
    try {
      if (!this.silentAudioEl) {
        const audio = document.createElement('audio');
        audio.setAttribute('playsinline', '');
        audio.setAttribute('webkit-playsinline', '');
        audio.preload = 'auto';
        // 0.05s silent WAV base64
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        this.silentAudioEl = audio;
      }
      const playPromise = this.silentAudioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch {}
  }

  /**
   * Global listeners attached in capture phase to unlock audio on the very first user tap
   */
  private setupUnlockListeners() {
    const unlock = () => {
      this.unlockiOSAudio();
      this.unlockAudio();
    };

    const unlockEvents = [
      'pointerdown',
      'touchstart',
      'touchend',
      'mousedown',
      'mouseup',
      'click',
      'keydown'
    ];

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
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (e) {
        console.warn('[Dots Audio] Context creation failed:', e);
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
   * is ready.
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
            console.warn('[Dots Audio] Resume failed:', err);
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
   * If AudioContext is running, executes synchronously.
   * If AudioContext is suspended, unlocks and resumes it first and THEN executes action.
   */
  private runWithAudio(action: (ctx: AudioContext, destination: AudioNode) => void) {
    if (this.isMuted) return;
    this.unlockiOSAudio();

    const ctx = this.ensureContext();
    if (!ctx) return;

    const dest = this.masterGain ?? ctx.destination;

    if (ctx.state === 'running') {
      try {
        action(ctx, dest);
      } catch (err) {
        console.warn('[Dots Audio] Playback error:', err);
      }
    } else {
      this.unlockAudio().then(() => {
        if (this.ctx && !this.isMuted) {
          try {
            action(this.ctx, this.masterGain ?? this.ctx.destination);
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

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }

    if (!this.isMuted) {
      this.unlockAudio().then(() => {
        // Play a cheerful confirmation chime when unmuted
        this.playConnectTone(2);
      });
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Plays a warm, rich wooden marimba/bell tone for connection step
   * Uses triangle wave + 2nd harmonic overtone for clarity on smartphone speakers
   */
  public playConnectTone(stepIndex: number) {
    this.runWithAudio((ctx, destination) => {
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
      gain.connect(destination);

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
      overGain.connect(destination);

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
    this.runWithAudio((ctx, destination) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(destination);

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
    this.runWithAudio((ctx, destination) => {
      const chord = [523.25, 659.25, 783.99, 1046.5];
      const now = ctx.currentTime;

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.035);

        const startTime = now + idx * 0.035;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

        osc.connect(gain);
        gain.connect(destination);

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
    this.runWithAudio((ctx, destination) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.38);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(destination);

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
    this.runWithAudio((ctx, destination) => {
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        const startTime = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

        osc.connect(gain);
        gain.connect(destination);

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
    this.runWithAudio((ctx, destination) => {
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
        gain.connect(destination);

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
    this.runWithAudio((ctx, destination) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSquare ? 600 : 420, now);
      osc.frequency.exponentialRampToValueAtTime(isSquare ? 1300 : 920, now + 0.12);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now);
      osc.stop(now + 0.15);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }
}
