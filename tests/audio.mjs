import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import ts from 'typescript';

const output = new URL('./.audio-unit.mjs', import.meta.url);
await writeFile(output, ts.transpileModule(await readFile(new URL('../src/audio.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const { WorkshopAudio } = await import(output.href);
const realTimeout = globalThis.setTimeout;
const realClear = globalThis.clearTimeout;
const scheduled = new Map();
let id = 0;
globalThis.setTimeout = (fn, ms) => { scheduled.set(++id, { fn, ms }); return id; };
globalThis.clearTimeout = key => scheduled.delete(key);
const sources = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() { this.disconnected = true; }, gain: param(), frequency: param(), detune: param(), Q: param() });
class AudioContextMock {
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createBuffer(_channels, size) { const data = new Float32Array(size); return { getChannelData: () => data }; }
  createOscillator() { return this.source('oscillator'); }
  createBufferSource() { return this.source('noise'); }
  source(kind) {
    const source = { ...node(), kind, start(time) { this.startAt = time; }, stop(time) { this.stopAt = time; } };
    sources.push(source); return source;
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
globalThis.AudioContext = AudioContextMock;
const audio = new WorkshopAudio();
try {
  assert.equal(sources.length, 0);
  audio.playAction('shred');
  audio.playCookieCrack();
  assert.equal(sources.length, 0, 'Muted actions create no audio nodes');
  audio.cancelAction();
  assert.equal(audio.setEnabled(true), true);
  await Promise.resolve();
  assert.equal(sources.filter(s => s.kind === 'oscillator').length, 4, 'Ambient chord starts without a click tone');
  const ambientEntry = [...scheduled].find(([, value]) => value.ms === 6500);
  assert.ok(ambientEntry);
  scheduled.delete(ambientEntry[0]); ambientEntry[1].fn();
  assert.ok(sources.some(s => s.kind === 'noise'), 'Intermittent fire texture is scheduled');
  assert.ok([...scheduled.values()].some(t => t.ms >= 12000 && t.ms <= 22000));

  const beforeCookie = sources.length;
  audio.playCookieCrack();
  const cookieSources = sources.slice(beforeCookie);
  assert.equal(cookieSources.length, 6);
  assert.ok(cookieSources.every(s => s.kind === 'noise' && s.stopAt < .45));
  assert.ok(cookieSources.every(s => s.buffer.getChannelData(0).some(sample => Math.abs(sample) > .01)));
  audio.cancelAction();
  assert.ok(cookieSources.every(s => s.disconnected), 'Cookie crack is cancelled on restart');

  const before = sources.length;
  audio.playAction('shred');
  const actionSources = sources.slice(before);
  assert.ok(actionSources.some(s => s.kind === 'noise'));
  assert.ok(actionSources.some(s => s.kind === 'oscillator'));
  audio.cancelAction();
  assert.ok(actionSources.every(s => s.disconnected), 'Restart cancels active and future action sources');

  const beforeFire = sources.length;
  audio.playAction('burn');
  assert.ok(sources.slice(beforeFire).every(s => s.kind === 'noise'), 'Burning uses noise and crackles, no pitched chime');
  audio.setEnabled(false);
  assert.equal(scheduled.size, 0);
  assert.ok(sources.every(s => s.disconnected), 'Mute disconnects every scheduled source immediately');

  audio.setEnabled(true); await Promise.resolve();
  audio.setHidden(true);
  const hiddenCookieCount = sources.length;
  audio.playCookieCrack();
  assert.equal(sources.length, hiddenCookieCount, 'Cookie stays silent in a hidden tab');
  assert.equal(scheduled.size, 0);
  assert.ok(sources.every(s => s.disconnected));
  const hiddenCount = sources.length;
  audio.setHidden(false);
  assert.ok(sources.length > hiddenCount);
  audio.dispose();
  assert.equal(scheduled.size, 0);
  assert.ok(sources.every(s => s.disconnected));
  assert.equal(audio.setEnabled(true), false);
  console.log('PASS: ambient scheduling, cookie crack, wood textures, action-specific audio, mute, reset, visibility, disposal');
} finally {
  audio.dispose();
  globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClear;
  delete globalThis.AudioContext;
  await unlink(output);
}
