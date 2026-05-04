import { Injectable } from '@angular/core';
import type {
  ClickCoordinatesResult,
  FullScreenshotResult,
  OcrImageBase64Options,
  PokiHelperPreload,
  WaitForNextClickCoordinatesOptions,
} from '../../poki-helper-preload';

/**
 * Angular façade for main-process automation in `PokiHelper - Electron/helper.js`
 * (exposed via preload as `window.pokiHelper`).
 *
 * When adding a new helper API, update helper.js, preload.js, main.js IPC handlers,
 * `poki-helper-preload.d.ts`, and this service together (see project rule
 * `.cursor/rules/poki-helper-ipc-sync.mdc`).
 */
@Injectable({
  providedIn: 'root',
})
export class ElectronHelper {
  /** True when running inside Electron with preload exposing `pokiHelper`. */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.pokiHelper;
  }

  private api(): PokiHelperPreload {
    const p = window.pokiHelper;
    if (!p) {
      throw new Error(
        'pokiHelper is not available. Run the app via Electron (`npm start` in PokiHelper - Electron) after `ng build`.',
      );
    }
    return p;
  }

  moveMouse(x: number, y: number): Promise<void> {
    return this.api().moveMouse(x, y);
  }

  getMousePosition(): Promise<{ x: number; y: number }> {
    return this.api().getMousePosition();
  }

  clickMouse(button?: 'left' | 'right' | 'middle'): Promise<void> {
    return this.api().clickMouse(button);
  }

  /**
   * Moves the cursor to screen `(x, y)`, waits 100 ms, then clicks with `button` (default left).
   */
  moveMouseThenClick(
    x: number,
    y: number,
    button?: 'left' | 'right' | 'middle',
  ): Promise<void> {
    return this.api().moveMouseThenClick(x, y, button);
  }

  doubleClickMouse(button?: 'left' | 'right' | 'middle'): Promise<void> {
    return this.api().doubleClickMouse(button);
  }

  scrollMouseVertical(amount: number): Promise<void> {
    return this.api().scrollMouseVertical(amount);
  }

  typeText(text: string): Promise<void> {
    return this.api().typeText(text);
  }

  keyTap(keyName: string): Promise<void> {
    return this.api().keyTap(keyName);
  }

  keyChord(modifierKeyNames: string[], keyName: string): Promise<void> {
    return this.api().keyChord(modifierKeyNames, keyName);
  }

  /**
   * Captures a DIP rectangle from two corners (same space as `waitForNextClickCoordinates`).
   * Corners may be passed in any order. Use `data:image/png;base64,` + `result.base64` for `<img [src]>`.
   */
  takeFullScreenshot(
    topLeftX: number,
    topLeftY: number,
    bottomRightX: number,
    bottomRightY: number,
  ): Promise<FullScreenshotResult> {
    return this.api().takeFullScreenshot(topLeftX, topLeftY, bottomRightX, bottomRightY);
  }

  /**
   * Captures a DIP rectangle from top-left to bottom-right (same coordinate space as the overlay picker).
   * Corners can be passed in any order. Uses nut-js only.
   */
  takeScreenshotRegionDip(
    topLeftX: number,
    topLeftY: number,
    bottomRightX: number,
    bottomRightY: number,
  ): Promise<FullScreenshotResult> {
    return this.api().takeScreenshotRegionDip(topLeftX, topLeftY, bottomRightX, bottomRightY);
  }

  /**
   * OCR in the main process (local Tesseract.js + bundled English data). No remote OCR API.
   */
  recognizeTextFromImageBase64(
    base64Image: string,
    options?: OcrImageBase64Options,
  ): Promise<string> {
    return this.api().recognizeTextFromImageBase64(base64Image, options ?? {});
  }

  /**
   * Reads the RGB color at DIP `(dipX, dipY)` and returns a CSS hex string `#rrggbb` (same coordinate space as the overlay picker).
   */
  getScreenPixelColorHex(dipX: number, dipY: number): Promise<string> {
    return this.api().getScreenPixelColorHex(dipX, dipY);
  }

  /**
   * Picks screen coordinates: opens a dim full-screen overlay (all monitors) with a crosshair (+) cursor,
   * then resolves with the click position (`screenX` / `screenY`). Esc cancels. Optional `button` filters
   * which button completes the wait (default left). Use `cancelWaitForNextClickCoordinates` to abort.
   */
  waitForNextClickCoordinates(
    options?: WaitForNextClickCoordinatesOptions,
  ): Promise<ClickCoordinatesResult> {
    return this.api().waitForNextClickCoordinates(options ?? {});
  }

  /** Cancels an in-flight {@link waitForNextClickCoordinates}. */
  cancelWaitForNextClickCoordinates(): Promise<boolean> {
    return this.api().cancelWaitForNextClickCoordinates();
  }
}
