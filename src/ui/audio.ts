/**
 * Tiny synthesized sound effects (WebAudio oscillators and noise) — no audio
 * assets needed. Starts only after a user gesture (browser autoplay rules).
 */
class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  play(kind: 'click' | 'power' | 'boom' | 'event'): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    if (kind === 'boom') {
      const len = 0.5;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      src.connect(lp).connect(gain);
      gain.gain.setValueAtTime(0.25, t);
      src.start(t);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = kind === 'event' ? 'triangle' : 'square';
    osc.connect(gain);
    const notes = kind === 'click' ? [660] : kind === 'power' ? [520, 780] : [392, 523, 659];
    notes.forEach((f, k) => osc.frequency.setValueAtTime(f, t + k * 0.07));
    gain.gain.setValueAtTime(kind === 'click' ? 0.03 : 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08 * notes.length + 0.1);
    osc.start(t);
    osc.stop(t + 0.08 * notes.length + 0.12);
  }
}

export const sound = new Sound();
