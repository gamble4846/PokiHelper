'use strict';

const path = require('path');
const { mouse, keyboard, Button, Key, Point, screen: nutScreen, Region } = require('@nut-tree-fork/nut-js');
const Jimp = require('jimp');
const { createWorker, OEM, PSM } = require('tesseract.js');

const MOUSE_MIN = -32768;
const MOUSE_MAX = 32767;

/**
 * Shrink capture width/height from the right and bottom only so libnut-win32 accepts the rect.
 * Symmetric inset (moving left/top) breaks non-primary monitors: "x coordinate outside of display".
 */
const CAPTURE_EDGE_TRIM_PX = 12;

function clampInt(value, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) {
    throw new TypeError('Expected a finite number');
  }
  return Math.min(max, Math.max(min, n));
}

function resolveMouseButton(button) {
  const b = String(button ?? 'left').toLowerCase();
  if (b === 'right') return Button.RIGHT;
  if (b === 'middle') return Button.MIDDLE;
  return Button.LEFT;
}

function resolveKey(keyName) {
  if (typeof keyName !== 'string' || keyName.length === 0) {
    throw new TypeError('keyName must be a non-empty string');
  }
  const k = Key[keyName];
  if (k === undefined) {
    throw new TypeError(
      `Unknown Key: ${keyName}. Use @nut-tree-fork/nut-js Key names (e.g. Enter, Escape, A, Space).`,
    );
  }
  return k;
}

/**
 * Chromium / overlay mouse `screenX` / `screenY` are device-independent (DIP) on Windows.
 * nut-js uses physical screen pixels for `setPosition`. Convert when Electron exposes it.
 * @param {number} x
 * @param {number} y
 * @returns {{ x: number, y: number }}
 */
function dipToPhysicalScreenPoint(x, y) {
  const rx = Math.round(Number(x));
  const ry = Math.round(Number(y));
  try {
    const { screen } = require('electron');
    if (screen && typeof screen.dipToScreenPoint === 'function') {
      const p = screen.dipToScreenPoint({ x: rx, y: ry });
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
  } catch {
    /* helper loaded outside Electron main */
  }
  return { x: rx, y: ry };
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {{ x: number, y: number }}
 */
function physicalToDipScreenPoint(x, y) {
  const rx = Math.round(Number(x));
  const ry = Math.round(Number(y));
  try {
    const { screen } = require('electron');
    if (screen && typeof screen.screenToDipPoint === 'function') {
      const p = screen.screenToDipPoint({ x: rx, y: ry });
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
  } catch {
    /* helper loaded outside Electron main */
  }
  return { x: rx, y: ry };
}

/**
 * Move the system cursor. `x` / `y` use the same space as Chromium `screenX` / `screenY`
 * (DIP on scaled Windows monitors); they are converted for nut-js when needed.
 * @param {number} x
 * @param {number} y
 * @returns {Promise<void>}
 */
async function moveMouse(x, y) {
  const dpx = clampInt(x, MOUSE_MIN, MOUSE_MAX);
  const dpy = clampInt(y, MOUSE_MIN, MOUSE_MAX);
  const phys = dipToPhysicalScreenPoint(dpx, dpy);
  await mouse.setPosition(
    new Point(clampInt(phys.x, MOUSE_MIN, MOUSE_MAX), clampInt(phys.y, MOUSE_MIN, MOUSE_MAX)),
  );
}

/**
 * @returns {Promise<{ x: number; y: number }>} DIP screen coordinates (matches overlay / `screenX`/`screenY`).
 */
async function getMousePosition() {
  const p = await mouse.getPosition();
  const dip = physicalToDipScreenPoint(p.x, p.y);
  return { x: dip.x, y: dip.y };
}

/**
 * @param {'left'|'right'|'middle'} [button='left']
 * @returns {Promise<void>}
 */
async function clickMouse(button = 'left') {
  await mouse.click(resolveMouseButton(button));
}

/**
 * Move to screen coordinates, wait 100 ms, then click the given button.
 * @param {number} x
 * @param {number} y
 * @param {'left'|'right'|'middle'} [button='left']
 * @returns {Promise<void>}
 */
async function moveMouseThenClick(x, y, button = 'left') {
  await moveMouse(x, y);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await clickMouse(button);
}

/**
 * @param {'left'|'right'|'middle'} [button='left']
 * @returns {Promise<void>}
 */
async function doubleClickMouse(button = 'left') {
  await mouse.doubleClick(resolveMouseButton(button));
}

/**
 * Vertical wheel scroll. Positive scrolls up, negative scrolls down.
 * @param {number} amount Steps (OS-dependent step size).
 * @returns {Promise<void>}
 */
async function scrollMouseVertical(amount) {
  const steps = clampInt(Math.abs(amount), 0, 100);
  if (steps === 0) return;
  if (amount > 0) {
    await mouse.scrollUp(steps);
  } else {
    await mouse.scrollDown(steps);
  }
}

/**
 * Types text using the system keyboard layout (same as physical typing).
 * @param {string} text
 * @returns {Promise<void>}
 */
async function typeText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }
  await keyboard.type(text);
}

/**
 * Press and release a single key. `keyName` must match a nut-js `Key` enum name (e.g. "Enter", "Space").
 * @param {string} keyName
 * @returns {Promise<void>}
 */
async function keyTap(keyName) {
  const k = resolveKey(keyName);
  await keyboard.pressKey(k);
  await keyboard.releaseKey(k);
}

/**
 * Hold modifier keys, tap a key, then release modifiers (order preserved for press/release).
 * @param {string[]} modifierKeyNames e.g. ["LeftControl", "LeftShift"]
 * @param {string} keyName e.g. "V"
 * @returns {Promise<void>}
 */
async function keyChord(modifierKeyNames, keyName) {
  if (!Array.isArray(modifierKeyNames)) {
    throw new TypeError('modifierKeyNames must be an array of Key names');
  }
  const mods = modifierKeyNames.map(resolveKey);
  const k = resolveKey(keyName);
  await keyboard.pressKey(...mods, k);
  await keyboard.releaseKey(...mods, k);
}

/**
 * @param {any} image
 * @returns {Promise<Buffer>}
 */
function jimpToPngBuffer(image) {
  return new Promise((resolve, reject) => {
    image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
}

/**
 * Trim width/height from the far edges only; origin stays fixed so multi-monitor captures stay valid.
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} px max pixels to remove from width and from height
 */
function trimPhysicalRectFromFarEdge(rect, px) {
  const p = Math.max(0, Math.round(Number(px)) || 0);
  const dw = Math.min(p, Math.max(0, rect.width - 1));
  const dh = Math.min(p, Math.max(0, rect.height - 1));
  return {
    left: rect.left,
    top: rect.top,
    width: Math.max(1, rect.width - dw),
    height: Math.max(1, rect.height - dh),
  };
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} a
 * @param {{ left: number, top: number, width: number, height: number }} b
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
function intersectPhysicalRects(a, b) {
  const l = Math.max(a.left, b.left);
  const t = Math.max(a.top, b.top);
  const r = Math.min(a.left + a.width, b.left + b.width);
  const bot = Math.min(a.top + a.height, b.top + b.height);
  if (r <= l || bot <= t) {
    return null;
  }
  return {
    left: l,
    top: t,
    width: Math.max(1, Math.round(r - l)),
    height: Math.max(1, Math.round(bot - t)),
  };
}

const NUT_CAPTURE_REJECT_RE = /exceeds display|outside of display|display dimensions/i;

/**
 * Normalized DIP rectangle from two opposite corners (order-independent).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function normalizeDipRect(x1, y1, x2, y2) {
  const l = Math.trunc(Math.min(Number(x1), Number(x2)));
  const t = Math.trunc(Math.min(Number(y1), Number(y2)));
  const r = Math.trunc(Math.max(Number(x1), Number(x2)));
  const b = Math.trunc(Math.max(Number(y1), Number(y2)));
  const w = clampInt(Math.max(1, r - l), 1, MOUSE_MAX);
  const h = clampInt(Math.max(1, b - t), 1, MOUSE_MAX);
  return {
    left: clampInt(l, MOUSE_MIN, MOUSE_MAX),
    top: clampInt(t, MOUSE_MIN, MOUSE_MAX),
    width: w,
    height: h,
  };
}

/**
 * Axis-aligned physical pixel bounds for a DIP axis-aligned rectangle (handles per-monitor scaling).
 * @param {number} leftDip
 * @param {number} topDip
 * @param {number} widthDip
 * @param {number} heightDip
 */
function dipAxisRectToPhysicalRegion(leftDip, topDip, widthDip, heightDip) {
  const rightDip = leftDip + widthDip;
  const bottomDip = topDip + heightDip;
  const tl = dipToPhysicalScreenPoint(leftDip, topDip);
  const tr = dipToPhysicalScreenPoint(rightDip, topDip);
  const bl = dipToPhysicalScreenPoint(leftDip, bottomDip);
  const br = dipToPhysicalScreenPoint(rightDip, bottomDip);
  const xs = [tl.x, tr.x, bl.x, br.x];
  const ys = [tl.y, tr.y, bl.y, br.y];
  const minPx = Math.min(...xs);
  const minPy = Math.min(...ys);
  const maxPx = Math.max(...xs);
  const maxPy = Math.max(...ys);
  return {
    left: Math.round(minPx),
    top: Math.round(minPy),
    width: Math.max(1, Math.round(maxPx - minPx)),
    height: Math.max(1, Math.round(maxPy - minPy)),
  };
}

/**
 * @param {any} shot nut-js screen Image
 */
async function jimpFromNutScreenshot(shot) {
  const rgb = await shot.toRGB();
  return new Promise((resolve, reject) => {
    new Jimp(rgb.width, rgb.height, (err, image) => {
      if (err) {
        reject(err);
        return;
      }
      image.bitmap.data.set(Buffer.from(rgb.data));
      resolve(image);
    });
  });
}

/**
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @returns {Promise<any>} Jimp image
 */
async function nutGrabRegionWithShrink(left, top, width, height) {
  let r = { left, top, width, height };
  let lastErr;
  for (let attempt = 0; attempt < 96; attempt++) {
    try {
      const shot = await nutScreen.grabRegion(new Region(r.left, r.top, r.width, r.height));
      return await jimpFromNutScreenshot(shot);
    } catch (e) {
      lastErr = e;
      const msg = e && typeof e.message === 'string' ? e.message : String(e);
      if (NUT_CAPTURE_REJECT_RE.test(msg) && r.width > 16 && r.height > 16) {
        r = { left: r.left, top: r.top, width: r.width - 1, height: r.height - 1 };
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * @param {{ j: any, x: number, y: number }[]} pieces top-left placement on canvas (physical px, relative to fullPhysRaw)
 * @param {number} canvasW
 * @param {number} canvasH
 */
async function compositeJimpAtOffsets(pieces, canvasW, canvasH) {
  const canvas = await new Promise((resolve, reject) => {
    new Jimp(canvasW, canvasH, (err, image) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(image);
    });
  });
  for (const { j, x, y } of pieces) {
    canvas.composite(j, Math.round(x), Math.round(y));
  }
  const png = await jimpToPngBuffer(canvas);
  return {
    width: canvasW,
    height: canvasH,
    base64: png.toString('base64'),
  };
}

/**
 * libnut-win32 `grabRegion` expects **monitor-local** pixels; global virtual-desktop coords fail on
 * non-primary displays ("x coordinate outside of display"). Split the DIP rect per Electron display.
 * @param {any} electronScreen
 * @param {{ left: number, top: number, width: number, height: number }} dip
 */
async function takeScreenshotRegionDipNutSplitByDisplays(electronScreen, dip) {
  const displays = electronScreen.getAllDisplays();
  const fullPhysRaw = dipAxisRectToPhysicalRegion(dip.left, dip.top, dip.width, dip.height);
  const fullPhys = trimPhysicalRectFromFarEdge(fullPhysRaw, CAPTURE_EDGE_TRIM_PX);

  const pieces = [];
  for (const d of displays) {
    const b = d.bounds;
    const il = Math.max(dip.left, b.x);
    const it = Math.max(dip.top, b.y);
    const ir = Math.min(dip.left + dip.width, b.x + b.width);
    const ib = Math.min(dip.top + dip.height, b.y + b.height);
    if (ir <= il || ib <= it) {
      continue;
    }

    const subPhys = dipAxisRectToPhysicalRegion(il, it, ir - il, ib - it);
    const monPhys = dipAxisRectToPhysicalRegion(b.x, b.y, b.width, b.height);
    const overlap = intersectPhysicalRects(subPhys, monPhys);
    if (!overlap) {
      continue;
    }

    const localRect = {
      left: overlap.left - monPhys.left,
      top: overlap.top - monPhys.top,
      width: overlap.width,
      height: overlap.height,
    };
    const grabRect = trimPhysicalRectFromFarEdge(localRect, CAPTURE_EDGE_TRIM_PX);

    let j;
    try {
      j = await nutGrabRegionWithShrink(grabRect.left, grabRect.top, grabRect.width, grabRect.height);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e);
      throw new Error(`Region screenshot failed (nut-js) on a display: ${msg}`);
    }

    const destXGlobal = monPhys.left + grabRect.left;
    const destYGlobal = monPhys.top + grabRect.top;
    pieces.push({
      j,
      x: destXGlobal - fullPhysRaw.left,
      y: destYGlobal - fullPhysRaw.top,
    });
  }

  if (pieces.length === 0) {
    throw new Error('Region screenshot: selection does not overlap any display.');
  }

  return compositeJimpAtOffsets(pieces, fullPhys.width, fullPhys.height);
}

/**
 * PNG of a screen rectangle in DIP space (same as overlay / `moveMouse`). Uses nut-js only (no DXGI).
 * Pass top-left and bottom-right corners; order does not matter.
 * @param {number} topLeftX
 * @param {number} topLeftY
 * @param {number} bottomRightX
 * @param {number} bottomRightY
 * @returns {Promise<{ width: number, height: number, base64: string }>}
 */
async function takeScreenshotRegionDip(topLeftX, topLeftY, bottomRightX, bottomRightY) {
  const dip = normalizeDipRect(topLeftX, topLeftY, bottomRightX, bottomRightY);

  let electronScreen = null;
  try {
    ({ screen: electronScreen } = require('electron'));
  } catch {
    /* helper outside Electron main */
  }

  if (electronScreen?.getAllDisplays) {
    try {
      return await takeScreenshotRegionDipNutSplitByDisplays(electronScreen, dip);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e);
      throw new Error(
        `Region screenshot failed (nut-js). Multi-monitor split or capture driver: ${msg}`,
      );
    }
  }

  const physRaw = dipAxisRectToPhysicalRegion(dip.left, dip.top, dip.width, dip.height);
  const phys = trimPhysicalRectFromFarEdge(physRaw, CAPTURE_EDGE_TRIM_PX);
  try {
    const j = await nutGrabRegionWithShrink(phys.left, phys.top, phys.width, phys.height);
    const png = await jimpToPngBuffer(j);
    return {
      width: j.bitmap.width,
      height: j.bitmap.height,
      base64: png.toString('base64'),
    };
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e);
    throw new Error(
      `Region screenshot failed (nut-js). Very large regions or multi-monitor rectangles may be rejected by the capture driver: ${msg}`,
    );
  }
}

/**
 * DIP rectangle screenshot (same coordinate space as `moveMouse` / `waitForNextClickCoordinates`).
 * Corner order does not matter. Uses the same nut-js path as `takeScreenshotRegionDip`.
 * @param {number} topLeftX
 * @param {number} topLeftY
 * @param {number} bottomRightX
 * @param {number} bottomRightY
 * @returns {Promise<{ width: number, height: number, base64: string }>}
 */
async function takeFullScreenshot(topLeftX, topLeftY, bottomRightX, bottomRightY) {
  for (const v of [topLeftX, topLeftY, bottomRightX, bottomRightY]) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new TypeError('takeFullScreenshot expects four finite DIP coordinates');
    }
  }
  return takeScreenshotRegionDip(topLeftX, topLeftY, bottomRightX, bottomRightY);
}

/**
 * @param {number} n
 * @returns {string}
 */
function byteToHex2(n) {
  const b = clampInt(Math.round(Number(n)), 0, 255);
  return b.toString(16).padStart(2, '0');
}

/**
 * @param {any} j Jimp image (expects at least one pixel).
 * @param {number} x
 * @param {number} y
 * @returns {string} `#rrggbb` lowercase.
 */
function jimpPixelAtToHex(j, x, y) {
  const xi = clampInt(Math.trunc(x), 0, j.bitmap.width - 1);
  const yi = clampInt(Math.trunc(y), 0, j.bitmap.height - 1);
  const idx = (yi * j.bitmap.width + xi) * 4;
  const d = j.bitmap.data;
  return `#${byteToHex2(d[idx])}${byteToHex2(d[idx + 1])}${byteToHex2(d[idx + 2])}`;
}

/**
 * One representative RGB sample when a 1×1 DIP region maps to multiple physical pixels (per-monitor scaling).
 * @param {any} j Jimp image
 * @returns {string} `#rrggbb` lowercase.
 */
function jimpRepresentativePixelToHex(j) {
  const cx = Math.max(0, Math.floor((j.bitmap.width - 1) / 2));
  const cy = Math.max(0, Math.floor((j.bitmap.height - 1) / 2));
  return jimpPixelAtToHex(j, cx, cy);
}

/**
 * Samples the screen at DIP coordinates (same space as coordinate pick / `moveMouse` / `waitForNextClickCoordinates`).
 * Uses nut-js capture with per-display monitor-local rects on Windows multi-monitor setups.
 *
 * @param {number} dipX
 * @param {number} dipY
 * @returns {Promise<string>} CSS-style hex color `#rrggbb`.
 */
async function getScreenPixelColorHex(dipX, dipY) {
  for (const v of [dipX, dipY]) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new TypeError('getScreenPixelColorHex expects finite DIP coordinates');
    }
  }
  const px = Math.trunc(Number(dipX));
  const py = Math.trunc(Number(dipY));

  let electronScreen = null;
  try {
    ({ screen: electronScreen } = require('electron'));
  } catch {
    /* helper outside Electron main */
  }

  if (electronScreen?.getAllDisplays) {
    /** Same DIP→monitor-local pipeline as {@link takeScreenshotRegionDipNutSplitByDisplays} (1×1 rect). */
    const dip = { left: px, top: py, width: 1, height: 1 };
    const displays = electronScreen.getAllDisplays();
    for (const d of displays) {
      const b = d.bounds;
      const il = Math.max(dip.left, b.x);
      const it = Math.max(dip.top, b.y);
      const ir = Math.min(dip.left + dip.width, b.x + b.width);
      const ib = Math.min(dip.top + dip.height, b.y + b.height);
      if (ir <= il || ib <= it) {
        continue;
      }

      const subPhys = dipAxisRectToPhysicalRegion(il, it, ir - il, ib - it);
      const monPhys = dipAxisRectToPhysicalRegion(b.x, b.y, b.width, b.height);
      const overlap = intersectPhysicalRects(subPhys, monPhys);
      if (!overlap) {
        continue;
      }

      const localRect = {
        left: overlap.left - monPhys.left,
        top: overlap.top - monPhys.top,
        width: overlap.width,
        height: overlap.height,
      };
      const grabRect = trimPhysicalRectFromFarEdge(localRect, CAPTURE_EDGE_TRIM_PX);
      if (grabRect.width < 1 || grabRect.height < 1) {
        continue;
      }

      try {
        const j = await nutGrabRegionWithShrink(grabRect.left, grabRect.top, grabRect.width, grabRect.height);
        return jimpRepresentativePixelToHex(j);
      } catch (e) {
        const msg = e && typeof e.message === 'string' ? e.message : String(e);
        throw new Error(`getScreenPixelColorHex failed: ${msg}`);
      }
    }
    throw new Error('getScreenPixelColorHex: coordinates do not overlap any display');
  }

  const phys = dipToPhysicalScreenPoint(px, py);
  const lx = clampInt(Math.round(phys.x), MOUSE_MIN, MOUSE_MAX);
  const ly = clampInt(Math.round(phys.y), MOUSE_MIN, MOUSE_MAX);
  try {
    const j = await nutGrabRegionWithShrink(lx, ly, 1, 1);
    return jimpRepresentativePixelToHex(j);
  } catch (e) {
    const msg = e && typeof e.message === 'string' ? e.message : String(e);
    throw new Error(`getScreenPixelColorHex failed: ${msg}`);
  }
}

/** Directory with `eng.traineddata.gz` (bundled via `@tesseract.js-data/eng`). */
const TESSERACT_ENG_LANG_DIR = path.join(
  path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),
  '4.0.0_best_int',
);

/** Root of `tesseract.js-core` (WASM entrypoints live here). */
const TESSERACT_CORE_DIR = path.dirname(require.resolve('tesseract.js-core/package.json'));

let ocrWorkerPromise = null;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng', OEM.LSTM_ONLY, {
      corePath: TESSERACT_CORE_DIR,
      langPath: TESSERACT_ENG_LANG_DIR,
    });
  }
  return ocrWorkerPromise;
}

/**
 * @param {string} base64OrDataUrl raw base64 or `data:*;base64,...`
 * @returns {{ buffer: Buffer }}
 */
function decodeBase64ImagePayload(base64OrDataUrl) {
  const s = String(base64OrDataUrl).trim();
  const m = /^data:[^;]+;base64,(.+)$/i.exec(s);
  const b64 = m ? m[1] : s;
  return { buffer: Buffer.from(b64, 'base64') };
}

/**
 * Grayscale, mild contrast, upscale small captures / downscale huge images before OCR.
 * @param {Buffer} pngOrImageBuffer
 * @param {{ preprocess?: boolean }} opts
 * @returns {Promise<Buffer>} PNG buffer
 */
async function preprocessImageBufferForOcr(pngOrImageBuffer, opts) {
  if (opts.preprocess === false) {
    return pngOrImageBuffer;
  }
  let img = await Jimp.read(pngOrImageBuffer);
  const w0 = img.bitmap.width;
  const h0 = img.bitmap.height;
  const minSide = Math.min(w0, h0);
  const maxSide = Math.max(w0, h0);
  if (minSide > 0 && minSide < 400) {
    const f = Math.min(2.25, 400 / minSide);
    img = img.scale(f);
  }
  const maxAfter = Math.max(img.bitmap.width, img.bitmap.height);
  if (maxAfter > 1800) {
    img = img.scale(1800 / maxAfter);
  }
  img.greyscale().contrast(0.22);
  return jimpToPngBuffer(img);
}

/**
 * OCR in the Electron main process (tesseract.js + Node worker threads + local traineddata).
 * No cloud APIs; heavier work stays out of the renderer.
 *
 * @param {string} base64Image raw base64 or full data URL
 * @param {{ preprocess?: boolean, psm?: string | number, dpi?: number }} [options]
 * @returns {Promise<string>}
 */
async function recognizeTextFromImageBase64(base64Image, options) {
  if (typeof base64Image !== 'string' || base64Image.length === 0) {
    throw new TypeError('recognizeTextFromImageBase64 expects a non-empty string');
  }
  const opts = options && typeof options === 'object' ? options : {};
  const { buffer } = decodeBase64ImagePayload(base64Image);
  const pngBuf = await preprocessImageBufferForOcr(buffer, opts);

  const worker = await getOcrWorker();
  const psm = opts.psm != null ? String(opts.psm) : String(PSM.SINGLE_BLOCK);
  const dpi = opts.dpi != null ? String(opts.dpi) : '220';
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    user_defined_dpi: dpi,
  });

  const { data } = await worker.recognize(pngBuf);
  return (data.text || '').trim();
}

/**
 * @returns {Promise<void>}
 */
async function disposeOcrWorker() {
  if (!ocrWorkerPromise) {
    return;
  }
  const p = ocrWorkerPromise;
  ocrWorkerPromise = null;
  try {
    const w = await p;
    await w.terminate();
  } catch {
    /* ignore */
  }
}

module.exports = {
  moveMouse,
  getMousePosition,
  clickMouse,
  moveMouseThenClick,
  doubleClickMouse,
  scrollMouseVertical,
  typeText,
  keyTap,
  keyChord,
  takeFullScreenshot,
  takeScreenshotRegionDip,
  getScreenPixelColorHex,
  recognizeTextFromImageBase64,
  disposeOcrWorker,
};
