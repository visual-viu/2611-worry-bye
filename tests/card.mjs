import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import ts from 'typescript';

const output = new URL('./.card-unit.mjs', import.meta.url);
await writeFile(output, ts.transpileModule(await readFile(new URL('../src/fortune-card.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const { createFortuneCard } = await import(output.href);
const text = [];
const images = [];
const fontLoads = [];
const context = {
  font: '',
  drawImage(image, x, y, width, height) { images.push(image.src); if (!image.src.includes('workshop-unified')) assert.ok(Math.abs(width / height - image.naturalWidth / image.naturalHeight) < .0001, 'Prop preserves its aspect ratio'); },
  fillRect() {}, beginPath() {}, roundRect() {}, stroke() {}, fill() {}, save() {}, restore() {},
  createLinearGradient() { return { addColorStop() {} }; },
  measureText(value) { return { width: [...value].length * parseFloat(this.font.match(/\d+/)?.[0] ?? '24') }; },
  fillText(value, x, y) { text.push({ value, x, y, width: this.measureText(value).width }); },
};
const canvas = { width: 0, height: 0, getContext: () => context, toBlob(callback, type) { callback(new Blob(['canvas-output'], { type })); } };
globalThis.document = { fonts: { load: async (font) => { fontLoads.push(font); return []; } }, createElement: tag => { assert.equal(tag, 'canvas'); return canvas; } };
globalThis.Image = class {
  set src(value) {
    this.path = value;
    readFile(new URL(`../public${value}`, import.meta.url)).then(data => {
      assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a');
      this.naturalWidth = data.readUInt32BE(16); this.naturalHeight = data.readUInt32BE(20);
      this.onload();
    }).catch(() => this.onerror());
  }
  get src() { return this.path; }
};
try {
  const fortune = '오늘도 충분히 애썼어요.\n잠시 멈춰 쉬어도 괜찮아요.\n당신의 속도로 걸어가요.';
  const blob = await createFortuneCard(fortune);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(fontLoads, ['400 24px "Heejoy"', '700 42px "Heejoy"']);
  assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1440);
  assert.deepEqual(images, ['/assets/workshop-unified-mobile.png', '/assets/room-star-jar.png', '/assets/fortune-cookie-v2.png', '/assets/sleeping-cat.png']);
  for (const line of fortune.split('\n')) assert.ok(text.some(t => t.value === line));
  assert.ok(text.every(t => t.y > 0 && t.y < 1440 && t.width < 1000), 'Text fits within card');
  canvas.getContext = () => null;
  await assert.rejects(() => createFortuneCard(fortune), /이미지 저장을 지원하지/);
  console.log('PASS: card asset loading, 1080×1440 composition, fortune text placement, PNG export request, missing Canvas fallback');
} finally { delete globalThis.Image; delete globalThis.document; await unlink(output); }




