/**
 * Exposed by `PokiHelper - Electron/preload.js` when the Angular app runs inside Electron.
 * In `ng serve` / browser, `window.pokiHelper` is undefined.
 */
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
}

declare global {
  interface Window {
    pokiHelper?: PokiHelperPreload;
  }
}
