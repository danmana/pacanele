export class CabinetAudio {
  constructor() { this.enabled = true; this.context = null; this.motor = null; }
  async unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.enabled ? .55 : 0;
      const compressor = this.context.createDynamicsCompressor(); compressor.threshold.value = -15; compressor.ratio.value = 6;
      this.master.connect(compressor); compressor.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  setEnabled(value) { this.enabled = value; if (this.context) this.master.gain.setTargetAtTime(value ? .55 : 0, this.context.currentTime, .025); }
  tone(frequency, duration = .15, volume = .1, type = 'sine', delay = 0, endFrequency) {
    if (!this.context || !this.enabled) return;
    const c = this.context, start = c.currentTime + delay;
    const osc = c.createOscillator(), gain = c.createGain(); osc.type = type; osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .003); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(start); osc.stop(start + duration + .02); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  burst(duration, frequency, volume, delay = 0) {
    if (!this.context || !this.enabled) return;
    const c = this.context, start = c.currentTime + delay;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(); source.buffer = this.noise;
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .7;
    gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(start, Math.random()); source.stop(start + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  clack() { this.burst(.055, 1700, .6); this.tone(190, .095, .32, 'triangle', 0, 65); this.burst(.024, 3300, .18, .047); }
  startSpin() {
    this.stopSpin(); this.clack(); if (!this.context) return;
    const c = this.context;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    source.buffer = this.noise; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 650;
    gain.gain.setValueAtTime(0, c.currentTime); gain.gain.linearRampToValueAtTime(.085, c.currentTime + .3);
    const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = 27; depth.gain.value = .035; lfo.connect(depth); depth.connect(gain.gain);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(); lfo.start();
    this.motor = { source, filter, gain, lfo, depth };
    this.tone(170, .45, .08, 'sawtooth', 0, 320);
  }
  reelStop(index) { this.burst(.08, 900, .32); this.tone(115 + index * 16, .1, .18, 'triangle', 0, 60); this.tone(540 + index * 80, .07, .035); }
  stopSpin() {
    if (!this.motor || !this.context) return;
    const motor = this.motor; this.motor = null;
    motor.gain.gain.setTargetAtTime(0, this.context.currentTime, .025);
    motor.source.stop(this.context.currentTime + .15); motor.lfo.stop(this.context.currentTime + .15);
    motor.source.onended = () => Object.values(motor).forEach(node => node.disconnect());
  }
  win(big = false) {
    const notes = big ? [523, 659, 784, 1047, 784, 1047, 1319, 1568] : [659, 784, 1047, 1319];
    notes.forEach((note, i) => { this.tone(note, .42, .11, 'triangle', i * .115); this.tone(note * 2.001, .22, .028, 'sine', i * .115); });
    for (let i = 0; i < (big ? 22 : 9); i++) { this.tone(2400 + Math.random() * 2800, .13, .025, 'sine', .3 + i * .065); this.burst(.03, 6500, .025, .3 + i * .065); }
  }
  lose() { this.tone(196, .2, .055, 'triangle'); this.tone(146.8, .27, .055, 'triangle', .16); }
  receipt() { for (let i = 0; i < 9; i++) this.burst(.038, 2200, .05, i * .05); }
}
