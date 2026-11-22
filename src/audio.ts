type Mode = 'shred' | 'burn';
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[]; action: boolean };

/** Entirely local soundscape. No click sounds, recordings, requests or storage. */
export class WorkshopAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private enabled = false;
  private hidden = false;
  private disposed = false;
  private chord = 0;
  private nextTexture: Mode = 'burn';
  private action: { mode: Mode; endsAt: number } | null = null;

  constructor(private onUnavailable: () => void = () => {}) {}

  setEnabled(value: boolean): boolean {
    if (this.disposed) return false;
    this.enabled = value;
    this.stopVoices();
    if (!value) return false;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < samples.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * .025) / 1.025;
          samples[i] = brown * 2.8 + (Math.random() * 2 - 1) * .18;
        }
      }
      void this.ctx.resume().then(() => {
        if (this.enabled && !this.hidden && !this.disposed) this.startAmbience();
      }).catch(() => { if (!this.disposed) { this.setEnabled(false); this.onUnavailable(); } });
      return true;
    } catch { this.enabled = false; this.onUnavailable(); return false; }
  }

  setHidden(value: boolean) {
    if (this.hidden === value) return;
    this.hidden = value;
    this.stopVoices();
    if (!value && this.enabled) this.startAmbience();
  }

  playAction(mode: Mode, duration = 3.2) {
    this.cancelAction();
    this.action = { mode, endsAt: performance.now() + duration * 1000 };
    if (this.audible) this.texture(mode, duration, false);
  }

  playCookieCrack() {
    if (!this.audible) return;
    // One dry wafer snap followed by much smaller, fading crumbs.
    this.fracture(0, .085, .25, 'cookie', true);
    this.fracture(.032, .06, .17, 'cookie', true);
    [.11, .17, .24, .33].forEach((delay, index) => {
      this.fracture(delay, .035 + index * .008, .09 / (1 + index * .65), 'cookie', true);
    });
  }

  cancelAction() {
    this.action = null;
    for (const voice of [...this.voices]) if (voice.action) this.stopVoice(voice);
  }

  dispose() {
    this.disposed = true;
    this.enabled = false;
    this.action = null;
    this.stopVoices();
    void this.ctx?.close().catch(() => {});
  }

  private get audible() { return this.enabled && !this.hidden && !this.disposed && !!this.ctx; }

  private later(fn: () => void, ms: number) {
    const id = setTimeout(() => { this.timers.delete(id); if (this.audible) fn(); }, ms);
    this.timers.add(id);
  }

  private startAmbience() {
    if (!this.audible) return;
    this.stopVoices();
    const now = this.ctx!.currentTime;
    this.master!.gain.setValueAtTime(0, now);
    this.master!.gain.linearRampToValueAtTime(.7, now + 1.5);
    this.pad();
    this.later(() => this.ambientTexture(), 6500);
    if (this.action) {
      const remaining = (this.action.endsAt - performance.now()) / 1000;
      if (remaining > .1) this.texture(this.action.mode, remaining, false);
      else this.action = null;
    }
  }

  private pad() {
    // Slow, overlapping Cmaj7 / Am7 / Fmaj7 / Gsus2 tones, no percussive attacks.
    const chords = [[130.81, 196, 246.94, 329.63], [110, 164.81, 196, 261.63], [130.81, 174.61, 220, 329.63], [146.83, 196, 220, 293.66]];
    const ctx = this.ctx!;
    chords[this.chord++ % chords.length].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 ? 3 : -3;
      this.voice(oscillator, 11, .022, false, 3, 4);
    });
    this.later(() => this.pad(), 8000);
  }

  private ambientTexture() {
    if (!this.action || performance.now() >= this.action.endsAt) {
      this.texture(this.nextTexture, this.nextTexture === 'burn' ? 3 : 1.8, true);
      this.nextTexture = this.nextTexture === 'burn' ? 'shred' : 'burn';
    }
    this.later(() => this.ambientTexture(), 12000 + Math.random() * 10000);
  }

  private texture(mode: Mode, duration: number, ambient: boolean) {
    const ctx = this.ctx!;
    const level = ambient ? .23 : 1;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = mode === 'burn' ? 'lowpass' : 'bandpass';
    filter.frequency.value = mode === 'burn' ? 620 : 720;
    filter.Q.value = .65;
    this.voice(noise, duration, (mode === 'burn' ? .06 : .17) * level, !ambient, .2, .35, filter);
    if (mode === 'shred') {
      // Quiet motor hum plus softly modulated friction, rather than musical beeps.
      const motor = ctx.createOscillator();
      motor.type = 'triangle';
      motor.frequency.setValueAtTime(68, ctx.currentTime);
      motor.frequency.linearRampToValueAtTime(83, ctx.currentTime + Math.min(.3, duration / 3));
      motor.frequency.linearRampToValueAtTime(58, ctx.currentTime + duration);
      this.voice(motor, duration, .045 * level, !ambient, .12, .3);
      for (let i = 0; i < Math.floor(duration * 7); i++) {
        this.crackle(i / 7, .07, .035 * level, 1450, !ambient);
      }
    } else {
      // Clusters of two or three dry wood pops, separated by quiet gaps.
      // A baked exponential transient avoids the old sustained hiss texture.
      let time = .08;
      while (time < duration - .18) {
        const hits = Math.random() < .55 ? 2 : 3;
        for (let hit = 0; hit < hits; hit++) {
          const at = time + hit * (.035 + Math.random() * .035);
          const length = .045 + Math.random() * .065;
          if (at + length < duration) this.fracture(at, length, (.19 + Math.random() * .12) * level / (1 + hit * .35), 'wood', !ambient);
        }
        time += .32 + Math.random() * .5;
      }
    }
  }

  private fracture(delay: number, duration: number, level: number, material: 'wood' | 'cookie', action: boolean) {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    const body = material === 'wood' ? 180 + Math.random() * 260 : 1300 + Math.random() * 1100;
    for (let i = 0; i < samples.length; i++) {
      const time = i / ctx.sampleRate;
      const progress = i / samples.length;
      const attack = Math.min(1, time / .0015);
      const decay = Math.exp(-progress * (material === 'wood' ? 7 : 10));
      const grain = (Math.random() * 2 - 1) * .72;
      const resonance = Math.sin(2 * Math.PI * body * time) * .24 * Math.exp(-progress * 9);
      samples[i] = (grain + resonance) * attack * decay * (1 - progress);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = material === 'wood' ? 3200 : 6500;
    filter.Q.value = .5;
    this.voice(source, duration, level, action, .0015, duration * .4, filter, delay);
  }

  private crackle(delay: number, duration: number, level: number, frequency: number, action: boolean) {
    const source = this.ctx!.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = .8;
    this.voice(source, duration, level, action, .008, duration * .7, filter, delay);
  }

  private voice(source: AudioScheduledSourceNode, duration: number, volume: number, action: boolean, attack: number, release: number, filter?: BiquadFilterNode, delay = 0) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    attack = Math.min(attack, duration * .3);
    release = Math.min(release, duration * .4);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.setValueAtTime(volume, start + duration - release);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    if (filter) { source.connect(filter); filter.connect(gain); } else source.connect(gain);
    gain.connect(this.master!);
    const voice = { source, nodes: filter ? [filter, gain] : [gain], action };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); voice.nodes.forEach(node => node.disconnect()); this.voices.delete(voice); };
    source.start(start);
    source.stop(start + duration + .02);
  }

  private stopVoice(voice: Voice) {
    try { voice.source.stop(); } catch { /* Already ended. */ }
    voice.source.disconnect();
    voice.nodes.forEach(node => node.disconnect());
    this.voices.delete(voice);
  }

  private stopVoices() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    for (const voice of [...this.voices]) this.stopVoice(voice);
  }
}
