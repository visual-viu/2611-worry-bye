import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { jsx } = await import('react/jsx-runtime');
const compiled = new URL('./.app-test.mjs', import.meta.url);
const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
await writeFile(compiled, ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const audioCompiled = new URL('./.audio-test.mjs', import.meta.url);
await writeFile(audioCompiled, ts.transpileModule(await readFile(new URL('../src/audio.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
await writeFile(compiled, (await readFile(compiled, 'utf8')).replace("'./audio'", "'./.audio-test.mjs'"));
const cardCompiled = new URL('./.card-test.mjs', import.meta.url);
await writeFile(cardCompiled, ts.transpileModule(await readFile(new URL('../src/fortune-card.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
await writeFile(compiled, (await readFile(compiled, 'utf8')).replace("'./fortune-card'", "'./.card-test.mjs'"));
const { default: App } = await import(compiled.href);
const root = createRoot(document.getElementById('root'));
const find = (text) => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text) || b.getAttribute('aria-label') === text);
const click = async (text) => { const b = find(text); assert.ok(b, `Button exists: ${text}`); assert.equal(b.disabled, false); await act(async () => { b.click(); await Promise.resolve(); }); };
const wait = async (ms) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const scene = (name) => assert.ok(document.querySelector(`.scene-${name}`), `Scene is ${name}`);
async function fill(value) { const field = document.querySelector('textarea'); await act(() => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(field, value); field.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); }
async function start(text) { await click('마음 비우러 가기'); scene('write'); await fill(text); await click('다 적었어요'); await wait(800); scene('choose'); }
async function choose(text) { await click(text); await wait(550); scene('release'); }
let copied = '';
Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { copied = text; } }, configurable: true });
try {
  await act(() => root.render(jsx(App, {})));
  scene('welcome');
  assert.equal(find('소리 끄기').getAttribute('aria-pressed'), 'true', 'Sound defaults ON before first gesture');
  await click('마음 비우러 가기');
  assert.equal(find('다 적었어요').disabled, true);
  assert.equal(document.querySelector('textarea').maxLength, 200);
  await fill('   '); assert.equal(find('다 적었어요').disabled, true);
  await fill('업무가 많아서 지쳐요');
  assert.equal(document.querySelector('output').textContent, '11 / 200');
  await click('다 적었어요'); await wait(800); await choose('잘게 분쇄하기');
  await click('분쇄기로 보내기');
  assert.equal(find('마음이 가벼워지는 중').disabled, true);
  await wait(3500); scene('cookie');
  await click('포춘쿠키 열기');
  assert.ok(document.querySelector('.fortune-note').textContent.includes('오늘도 충분히 애썼어요'));
  await click('문구 복사하기'); assert.ok(copied.includes('당신의 속도'));
  assert.ok(find('이미지로 저장'));
  await click('이미지로 저장');
  assert.ok(document.querySelector('.copy-status').textContent.includes('이미지를 만들지 못했어요'), 'Export failure is recoverable without Canvas/Image');
  await click('다시 마음 비우기'); scene('welcome');
  console.log('PASS: empty/whitespace validation, 200 limit, shred button, fortune matching, copy, replay');

  await start('친구와의 관계가 어려워요'); await choose('불꽃에 보내기');
  const paper = document.querySelector('.worry-paper');
  await act(() => paper.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await wait(3500); scene('cookie'); await click('포춘쿠키 열기');
  assert.ok(document.querySelector('.fortune-note').textContent.includes('당신의 마음도 소중'));
  navigator.clipboard.writeText = async () => { throw Error('Clipboard unavailable'); };
  await click('문구 복사하기'); assert.ok(document.querySelector('.copy-status').textContent.includes('선택해서 복사'));
  await click('다시 마음 비우기');
  console.log('PASS: burn keyboard path, relationship fortune, clipboard fallback');

  await start('시험 때문에 불안해요'); await choose('잘게 분쇄하기');
  document.querySelector('.drop-zone').getBoundingClientRect = () => ({ left: 100, right: 400, top: 200, bottom: 500 });
  const dragPaper = document.querySelector('.worry-paper');
  const pointer = async (name, x, y) => act(() => dragPaper.dispatchEvent(new dom.window.MouseEvent(name, { bubbles: true, clientX: x, clientY: y })));
  await pointer('pointerdown', 200, 50); await pointer('pointermove', 20, 30); await pointer('pointerup', 20, 30);
  assert.equal(find('분쇄기로 보내기').disabled, false);
  await pointer('pointerdown', 200, 50); await pointer('pointermove', 230, 300); await pointer('pointerup', 230, 300);
  assert.equal(find('마음이 가벼워지는 중').disabled, true);
  await wait(3500); await click('포춘쿠키 열기');
  assert.ok(document.querySelector('.fortune-note').textContent.includes('당신만의 계절'));
  await click('다시 마음 비우기');
  console.log('PASS: rejected drop outside target, pointer drop inside target, study fortune');

  await click('마음 비우러 가기'); assert.equal(document.querySelector('textarea').value, '');
  await fill('테스트'); await click('다 적었어요'); await click('처음 화면으로'); await wait(850); scene('welcome');
  await start('다시 시작'); await choose('불꽃에 보내기'); await click('불꽃으로 보내기');
  await click('처음 화면으로'); await wait(3500); scene('welcome');
  await click('마음 비우러 가기'); assert.equal(document.querySelector('textarea').disabled, false);
  assert.equal(document.querySelector('textarea').value, '');
  assert.equal(dom.window.localStorage.length, 0); assert.equal(dom.window.sessionStorage.length, 0);
  console.log('PASS: restart cancels folding/release timers, clean input, no browser storage');
  await click('소리 켜기'); assert.equal(find('소리 켜기').getAttribute('aria-pressed'), 'false');
  assert.ok(document.querySelector('.audio-status').textContent.includes('소리를 재생할 수 없어요'));
  console.log('PASS: audio unavailable is reported, gameplay remains usable');} finally { await act(() => root.unmount()); dom.window.close(); await unlink(compiled); await unlink(audioCompiled); await unlink(cardCompiled); }





