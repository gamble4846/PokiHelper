/**
 * Exposed by `PokiHelper - Electron/preload.js` when the Angular app runs inside Electron.
 * In `ng serve` / browser, `window.pokiHelper` is undefined.
 */
export type ClickCaptureButton = 'left' | 'right' | 'middle' | 'any';

export interface WaitForNextClickCoordinatesOptions {
  /** Default 120_000 (2 minutes). Clamped 1_000–600_000 ms. */
  timeoutMs?: number;
  /** Which button completes the capture. Default `left`. */
  button?: ClickCaptureButton;
}

export interface ClickCoordinatesResult {
  x: number;
  y: number;
  button: 'left' | 'right' | 'middle' | 'unknown';
}

/** PNG screenshot result; `width` / `height` are pixel size of the image. Base64 without the `data:` prefix. */
export interface FullScreenshotResult {
  width: number;
  height: number;
  base64: string;
}

export interface PokiHelperPreload {
  moveMouse(x: number, y: number): Promise<void>;
  getMousePosition(): Promise<{ x: number; y: number }>;
  clickMouse(button?: 'left' | 'right' | 'middle'): Promise<void>;
  /** Moves to `(x, y)`, waits 100 ms, then clicks with `button` (default left). */
  moveMouseThenClick(
    x: number,
    y: number,
    button?: 'left' | 'right' | 'middle',
  ): Promise<void>;
  doubleClickMouse(button?: 'left' | 'right' | 'middle'): Promise<void>;
  scrollMouseVertical(amount: number): Promise<void>;
  typeText(text: string): Promise<void>;
  /** Key name must match nut-js `Key` (e.g. `Enter`, `Space`, `A`). */
  keyTap(keyName: string): Promise<void>;
  /** Example: `keyChord(['LeftControl'], 'V')` */
  keyChord(modifierKeyNames: string[], keyName: string): Promise<void>;
  /**
   * Captures a DIP rectangle (same space as coordinate pick). Pass top-left and bottom-right
   * corners; order-independent. Same capture path as `takeScreenshotRegionDip`.
   */
  takeFullScreenshot(
    topLeftX: number,
    topLeftY: number,
    bottomRightX: number,
    bottomRightY: number,
  ): Promise<FullScreenshotResult>;
  /**
   * Captures a rectangle in DIP screen space (same as coordinate pick / `moveMouse`).
   * Pass top-left and bottom-right corners; order-independent. Uses nut-js only (no DXGI).
   */
  takeScreenshotRegionDip(
    topLeftX: number,
    topLeftY: number,
    bottomRightX: number,
    bottomRightY: number,
  ): Promise<FullScreenshotResult>;
  /**
   * Shows a full-screen dim overlay (all monitors), crosshair (+) cursor, and resolves with `screenX` / `screenY`
   * on the first matching click. Esc cancels. Only one wait may be active at a time.
   */
  waitForNextClickCoordinates(
    options?: WaitForNextClickCoordinatesOptions,
  ): Promise<ClickCoordinatesResult>;
  /** Cancels an in-flight `waitForNextClickCoordinates`. Returns whether a wait was cancelled. */
  cancelWaitForNextClickCoordinates(): Promise<boolean>;
}

declare global {
  interface Window {
    pokiHelper?: PokiHelperPreload;
  }
}
