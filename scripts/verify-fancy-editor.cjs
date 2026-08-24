/*
 * Multimodal Playwright regression suite for the RichText/PlainText fancy demo.
 *
 * Usage:
 *   NODE_PATH=/path/to/playwright/node_modules pnpm test:fancy-editor
 *
 * The script reuses http://localhost:8081 when it is already running. If the
 * demo is unavailable, it starts a temporary Vite server and shuts it down.
 * Screenshots are written to /tmp/fancy-editor-playwright by default.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.FANCY_EDITOR_URL || 'http://127.0.0.1:8081';
const ARTIFACT_DIR = process.env.FANCY_ARTIFACT_DIR || '/tmp/fancy-editor-playwright';
const PRESETS = [
  'none', 'single-stroke', 'multi-stroke', 'gradient', 'shadow', 'texture', 'glow',
  'neon', 'metallic', 'glow-stroke-gradient', 'rainbow', 'frost', 'flame', 'stereo',
];
const VISUALLY_REQUIRED = new Set(PRESETS);

function assert (condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function isServerReady () {
  try {
    const response = await fetch(`${BASE_URL}/demo/fancy-render-plan.html`);

    return response.ok;
  } catch (_) {
    return false;
  }
}

async function waitForServer (timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await isServerReady()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Fancy editor server did not become ready at ${BASE_URL}.`);
}

async function ensureServer () {
  if (await isServerReady()) {
    return undefined;
  }

  const server = spawn(
    'pnpm',
    ['--filter', '@galacean/effects-plugin-rich-text', 'exec', 'vite', '--host', '127.0.0.1', '--port', '8081', '--strictPort'],
    { cwd: ROOT, stdio: 'ignore', detached: false },
  );

  try {
    await waitForServer();
  } catch (error) {
    server.kill('SIGTERM');
    throw error;
  }

  return server;
}

function writeAnalysis (imagePath) {
  const script = String.raw`
from PIL import Image
import json, sys
im = Image.open(sys.argv[1]).convert('RGBA')
small = im.convert('L').resize((68, 22))
chars = ' .:-=+*#%@'
lines = []
for y in range(small.height):
    lines.append(''.join(chars[min(9, small.getpixel((x, y)) * 10 // 256)] for x in range(small.width)))
luma = [.299*r + .587*g + .114*b for r,g,b,a in im.getdata()]
print(json.dumps({
  'width': im.width,
  'height': im.height,
  'brightPixels': sum(v > 90 for v in luma),
  'alphaPixels': sum(a > 10 for r,g,b,a in im.getdata()),
  'contrast': round(max(luma) - min(luma), 2),
  'ascii': '\\n'.join(lines),
}, ensure_ascii=False))
`;
  const result = require('child_process').execFileSync('python3', ['-c', script, imagePath], { encoding: 'utf8' });

  return JSON.parse(result);
}

function compareImages (leftPath, rightPath) {
  const script = String.raw`
from PIL import Image, ImageChops
import json, sys
left = Image.open(sys.argv[1]).convert('RGBA')
right = Image.open(sys.argv[2]).convert('RGBA')
if left.size != right.size:
    print(json.dumps({'differentPixels': left.width * left.height, 'meanDelta': 255}))
    raise SystemExit
diff = ImageChops.difference(left, right)
pixels = list(diff.getdata())
delta = [max(r, g, b, a) for r, g, b, a in pixels]
print(json.dumps({
  'differentPixels': sum(value > 8 for value in delta),
  'meanDelta': round(sum(delta) / max(1, len(delta)), 3),
}, ensure_ascii=False))
`;
  const result = require('child_process').execFileSync('python3', ['-c', script, leftPath, rightPath], { encoding: 'utf8' });

  return JSON.parse(result);
}

async function waitForOnline (page) {
  await page.waitForFunction(() =>
    (document.getElementById('status')?.textContent || '').includes('online') &&
    (document.getElementById('plain-status')?.textContent || '').includes('online'),
  { timeout: 30000 });
}

async function screenshotCanvas (page, selector, outputPath) {
  const canvas = await page.$(selector);

  assert(canvas, `Canvas not found: ${selector}`);
  await canvas.screenshot({ path: outputPath });

  return writeAnalysis(outputPath);
}

async function screenshotComponentCanvas (page, globalName, outputPath) {
  const dataUrl = await page.evaluate(name => window[name]?.canvas?.toDataURL('image/png'), globalName);

  assert(dataUrl?.startsWith('data:image/png;base64,'), `Offscreen component canvas unavailable: ${globalName}`);
  fs.writeFileSync(outputPath, Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'));

  return writeAnalysis(outputPath);
}

async function clickPreset (page, key) {
  const button = page.locator(`#preset-list [data-preset="${key}"]`);

  await button.click();
  await page.waitForTimeout(650);
  if (key === 'texture') {
    const target = await page.evaluate(() =>
      document.querySelector('[data-editor-target="plain"][data-active="true"]') ? '__plainTextDemo' : '__richTextDemo');

    await page.waitForFunction(name =>
      window[name]?.textStyle?.fancyRenderStyle?.layers?.some(layer => layer.kind === 'texture' && layer.runtimePattern),
    target, { timeout: 10000 });
    await page.waitForTimeout(250);
  }
}

async function setInputValue (page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function readState (page) {
  return page.evaluate(() => ({
    plainText: window.__plainTextDemo?.text,
    plainPreset: window.__plainTextDemo?.textStyle?.fancyConfig?.presetName,
    plainLayers: window.__plainTextDemo?.textStyle?.fancyRenderStyle?.layers?.map(layer => layer.kind),
    richPreset: window.__richTextDemo?.textStyle?.fancyConfig?.presetName,
    richConfig: window.__richTextDemo?.textStyle?.fancyConfig,
    richPlan: window.__richTextDemo?.getRenderPlan?.(),
  }));
}

async function main () {
  fs.rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(ARTIFACT_DIR, 'plain'), { recursive: true });
  fs.mkdirSync(path.join(ARTIFACT_DIR, 'rich'), { recursive: true });
  fs.mkdirSync(path.join(ARTIFACT_DIR, 'rtl'), { recursive: true });

  const temporaryServer = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });
  const errors = [];

  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !/Current running player count/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });

  try {
    await page.goto(`${BASE_URL}/demo/fancy-render-plan.html?capture=1`, { waitUntil: 'load' });
    await waitForOnline(page);

    // Boot and placement regression: the duplicate plain preset strip/input must be gone.
    const boot = await page.evaluate(() => ({
      sharedPresetCount: document.querySelectorAll('#preset-list [data-preset]').length,
      duplicatePlainPresetCount: document.querySelectorAll('[data-plain-preset]').length,
      duplicatePlainTextInput: Boolean(document.querySelector('#plain-text')),
      plainCanvas: Boolean(document.querySelector('#J-plain-container canvas')),
      richCanvas: Boolean(document.querySelector('#J-container canvas')),
    }));
    assert(boot.sharedPresetCount === PRESETS.length, `Expected ${PRESETS.length} shared presets, got ${boot.sharedPresetCount}.`);
    assert(boot.duplicatePlainPresetCount === 0, 'Duplicate plain preset strip is still present.');
    assert(!boot.duplicatePlainTextInput, 'Duplicate plain text input is still present above the plain preview.');
    assert(boot.plainCanvas && boot.richCanvas, 'Both preview canvases must be present.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'boot.png'), fullPage: true });

    // Plain mode: fixed editor schema must not vary with the selected preset.
    await page.click('[data-editor-target="plain"]');
    const plainFieldSignature = await page.evaluate(() => ({
      fields: Array.from(document.querySelectorAll('#editor-sections [data-field]')).map(element => element.getAttribute('data-field')),
      glowFields: Array.from(document.querySelectorAll('#editor-sections [data-glow-field]')).map(element => element.getAttribute('data-glow-field')),
      richOnlyHidden: Array.from(document.querySelectorAll('[data-rich-only]')).every(element => element.hidden),
      textValue: document.querySelector('#text')?.value,
    }));
    assert(plainFieldSignature.fields.length > 0, 'Plain mode has no fixed range fields.');
    assert(plainFieldSignature.glowFields.length > 0, 'Plain mode has no fixed object-effect fields.');
    assert(plainFieldSignature.richOnlyHidden, 'Rich-only controls are visible in plain mode.');
    assert(plainFieldSignature.textValue === 'Galacean 普通文本', 'Plain mode did not move the text editor into the shared editor.');

    let firstPlainSignature;
    let plainNoneImage;
    const plainVisual = {};
    for (const key of PRESETS) {
      await clickPreset(page, key);
      const signature = await page.evaluate(() => ({
        fields: Array.from(document.querySelectorAll('#editor-sections [data-field]')).map(element => element.getAttribute('data-field')),
        glowFields: Array.from(document.querySelectorAll('#editor-sections [data-glow-field]')).map(element => element.getAttribute('data-glow-field')),
      }));
      firstPlainSignature ??= signature;
      assert(JSON.stringify(signature) === JSON.stringify(firstPlainSignature), `Plain editor fields changed after preset ${key}.`);
      const imagePath = path.join(ARTIFACT_DIR, 'plain', `${key}.png`);
      plainVisual[key] = await screenshotCanvas(page, '#J-plain-container canvas', imagePath);
      const offscreen = await screenshotComponentCanvas(page, '__plainTextDemo', path.join(ARTIFACT_DIR, 'plain', `offscreen-${key}.png`));
      const state = await readState(page);
      assert(state.plainPreset === key, `Plain preset state did not update for ${key}.`);
      if (VISUALLY_REQUIRED.has(key)) {
        assert(offscreen.alphaPixels > 100, `Plain preset ${key} produced no visible text.`);
      }
      if (key === 'none') {
        plainNoneImage = imagePath;
      } else if (VISUALLY_REQUIRED.has(key)) {
        assert(compareImages(plainNoneImage, imagePath).differentPixels > 100, `Plain preset ${key} did not change the rendered effect.`);
      }
    }

    // Plain text editing and fixed controls update the TextComponent.
    await clickPreset(page, 'neon');
    const plainBeforeFill = path.join(ARTIFACT_DIR, 'plain', 'interaction-before-fill.png');
    const plainAfterFill = path.join(ARTIFACT_DIR, 'plain', 'interaction-after-fill.png');
    await screenshotCanvas(page, '#J-plain-container canvas', plainBeforeFill);
    await setInputValue(page, '#text', '普通文本编辑检查');
    await page.waitForTimeout(300);
    assert((await readState(page)).plainText === '普通文本编辑检查', 'Plain text input did not update TextComponent.');
    await setInputValue(page, '#editor-sections [data-field="fillColor"]', '#ff0000');
    await page.waitForTimeout(300);
    await screenshotCanvas(page, '#J-plain-container canvas', plainAfterFill);
    assert(compareImages(plainBeforeFill, plainAfterFill).differentPixels > 100, 'Plain Fill interaction did not change rendered pixels.');
    const plainLayerState = await page.evaluate(() => window.__plainTextDemo.textStyle.fancyConfig.layers);
    assert(plainLayerState.some(layer => layer.kind === 'solid-fill'), 'Plain fill control did not update FancyConfig.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'editor-plain.png'), fullPage: true });

    // Plain RTL: same shared backend, whole-string Canvas shaping, representative effect set.
    await setInputValue(page, '#text', 'مرحبا بالعالم');
    for (const key of ['none', 'single-stroke', 'shadow', 'glow', 'neon', 'flame']) {
      await clickPreset(page, key);
      const imagePath = path.join(ARTIFACT_DIR, 'rtl', `${key}.png`);
      await screenshotCanvas(page, '#J-plain-container canvas', imagePath);
      const analysis = await screenshotComponentCanvas(page, '__plainTextDemo', path.join(ARTIFACT_DIR, 'rtl', `offscreen-${key}.png`));
      assert(analysis.alphaPixels > 100, `RTL preset ${key} produced no visible text.`);
      if (key === 'none') {
        plainNoneImage = imagePath;
      } else if (key === 'neon') {
        assert(compareImages(plainNoneImage, imagePath).differentPixels > 100, 'RTL neon effect did not change rendered pixels.');
      }
    }

    // Rich mode: full preset application resets range overrides and keeps object effects global.
    await page.click('[data-editor-target="rich"]');
    assert((await page.$eval('#text', element => element.value)).startsWith('Range A'), 'Switching back to rich did not restore rich text.');
    await clickPreset(page, 'neon');
    let richState = await readState(page);
    assert(richState.richPreset === 'neon', 'Rich preset was not applied globally.');
    assert((richState.richConfig.rangeOverrides || []).every(value => value === null), 'Global rich preset did not clear range overrides.');
    const richVisual = {};
    let richNoneImage;
    for (const key of PRESETS) {
      await clickPreset(page, key);
      richState = await readState(page);
      assert(richState.richPreset === key, `Rich preset state did not update for ${key}.`);
      assert((richState.richConfig.rangeOverrides || []).every(value => value === null), `Rich preset ${key} left a range override behind.`);
      richVisual[key] = await screenshotCanvas(page, '#J-container canvas', path.join(ARTIFACT_DIR, 'rich', `${key}.png`));
      const offscreen = await screenshotComponentCanvas(page, '__richTextDemo', path.join(ARTIFACT_DIR, 'rich', `offscreen-${key}.png`));
      assert(offscreen.alphaPixels > 100, `Rich preset ${key} produced no visible text.`);
      const richImagePath = path.join(ARTIFACT_DIR, 'rich', `${key}.png`);
      if (key === 'none') {
        richNoneImage = richImagePath;
      } else if (VISUALLY_REQUIRED.has(key)) {
        assert(compareImages(richNoneImage, richImagePath).differentPixels > 100, `Rich preset ${key} did not change the rendered effect.`);
      }
    }

    // Range override + object effect separation.
    await clickPreset(page, 'neon');
    await page.locator('#segment-list .segment-row').first().click();
    const rangeControls = await page.evaluate(() => ({
      rangeFields: document.querySelectorAll('#editor-sections [data-field]').length,
      objectFields: document.querySelectorAll('#editor-sections [data-preset-path]').length,
      glowLabel: Array.from(document.querySelectorAll('#editor-sections .section-label')).some(element => element.textContent.includes('全文效果')),
    }));
    assert(rangeControls.rangeFields > 0, 'Rich range mode has no range controls.');
    assert(rangeControls.objectFields > 0 && rangeControls.glowLabel, 'Rich range mode lost editable global object effects.');
    const richBeforeRange = path.join(ARTIFACT_DIR, 'rich', 'interaction-before-range.png');
    const richAfterRange = path.join(ARTIFACT_DIR, 'rich', 'interaction-after-range.png');
    await screenshotCanvas(page, '#J-container canvas', richBeforeRange);
    await setInputValue(page, '#editor-sections [data-field="fillColor"]', '#ff0000');
    await page.waitForTimeout(300);
    await screenshotCanvas(page, '#J-container canvas', richAfterRange);
    assert(compareImages(richBeforeRange, richAfterRange).differentPixels > 100, 'Rich range Fill interaction did not change rendered pixels.');
    richState = await readState(page);
    assert(typeof richState.richConfig.rangeOverrides[0] === 'number', 'Editing a rich range did not create a range override.');
    const richBeforeGlow = path.join(ARTIFACT_DIR, 'rich', 'interaction-before-glow.png');
    const richAfterGlow = path.join(ARTIFACT_DIR, 'rich', 'interaction-after-glow.png');
    await screenshotCanvas(page, '#J-container canvas', richBeforeGlow);
    await setInputValue(page, '#editor-sections [data-preset-path="layers.0.decorations.0.params.color"]', '#ff00ff');
    await page.waitForTimeout(300);
    await screenshotCanvas(page, '#J-container canvas', richAfterGlow);
    assert(compareImages(richBeforeGlow, richAfterGlow).differentPixels > 100, 'Global Glow interaction did not change rendered pixels.');
    const glowBlur = page.locator('#editor-sections [data-preset-path="layers.0.decorations.0.params.blur"]').first();
    await glowBlur.evaluate(element => {
      element.value = '13';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    richState = await readState(page);
    assert(richState.richConfig.layers[0].decorations[0].params.blur === 13, 'Global Glow edit did not update the root object effect.');
    assert(typeof richState.richConfig.rangeOverrides[0] === 'number', 'Global Glow edit unexpectedly removed the range override.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'editor-rich-range.png'), fullPage: true });

    const result = {
      ok: true,
      artifactDir: ARTIFACT_DIR,
      boot,
      plainFieldCount: firstPlainSignature.fields.length + firstPlainSignature.glowFields.length,
      plainVisual,
      richVisual,
      errors,
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), JSON.stringify(result, null, 2));
    const summarize = visual => Object.fromEntries(
      Object.entries(visual).map(([key, value]) => [key, {
        brightPixels: value.brightPixels,
        alphaPixels: value.alphaPixels,
        contrast: value.contrast,
      }]),
    );
    console.log(JSON.stringify({
      ok: result.ok,
      artifactDir: result.artifactDir,
      boot: result.boot,
      plainFieldCount: result.plainFieldCount,
      plainVisual: summarize(result.plainVisual),
      richVisual: summarize(result.richVisual),
      errors: result.errors,
    }, null, 2));
  } finally {
    await browser.close();
    if (temporaryServer) {
      temporaryServer.kill('SIGTERM');
    }
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
