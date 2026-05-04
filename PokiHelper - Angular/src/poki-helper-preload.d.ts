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

export interface PokiHelperPreload {
  moveMouse(x: number, y: number): Promise<void>;
  getMousePosition(): Promise<{ x: number; y: number }>;
  clickMouse(button?: 'left' | 'right' | 'middle'): Promise<void>;
  doubleClickMouse(button?: 'left' | 'right' | 'middle'): Promise<void>;
  scrollMouseVertical(amount: number): Promise<void>;
  typeText(text: string): Promise<void>;
  /** Key name must match nut-js `Key` (e.g. `Enter`, `Space`, `A`). */
  keyTap(keyName: string): Promise<void>;
  /** Example: `keyChord(['LeftControl'], 'V')` */
  keyChord(modifierKeyNames: string[], keyName: string): Promise<void>;
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
