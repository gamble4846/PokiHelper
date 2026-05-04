'use strict';

const { mouse, keyboard, Button, Key, Point } = require('@nut-tree-fork/nut-js');

const MOUSE_MIN = -32768;
const MOUSE_MAX = 32767;

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
 * Move the system cursor to absolute screen coordinates (pixels).
 * @param {number} x
 * @param {number} y
 * @returns {Promise<void>}
 */
async function moveMouse(x, y) {
  const px = clampInt(x, MOUSE_MIN, MOUSE_MAX);
  const py = clampInt(y, MOUSE_MIN, MOUSE_MAX);
  await mouse.setPosition(new Point(px, py));
}

/**
 * @returns {Promise<{ x: number; y: number }>}
 */
async function getMousePosition() {
  const p = await mouse.getPosition();
  return { x: p.x, y: p.y };
}

/**
 * @param {'left'|'right'|'middle'} [button='left']
 * @returns {Promise<void>}
 */
async function clickMouse(button = 'left') {
  await mouse.click(resolveMouseButton(button));
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

module.exports = {
  moveMouse,
  getMousePosition,
  clickMouse,
  doubleClickMouse,
  scrollMouseVertical,
  typeText,
  keyTap,
  keyChord,
};
