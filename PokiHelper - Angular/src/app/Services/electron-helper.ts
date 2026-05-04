import { Injectable } from '@angular/core';
import type { PokiHelperPreload } from '../../poki-helper-preload';

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
}
