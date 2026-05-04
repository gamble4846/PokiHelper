import { Component } from '@angular/core';
import { ElectronHelper } from '../../Services/electron-helper';
import { ClickCoordinatesResult } from '../../../poki-helper-preload';

@Component({
  selector: 'app-trade-helper',
  imports: [],
  templateUrl: './trade-helper.html',
  styleUrl: './trade-helper.css',
})

export class TradeHelper {

  constructor(
    private electronHelper: ElectronHelper,
  ) { }

  PrintedCords: string = "";
  ToClickCords: ClickCoordinatesResult | null = null;
  /** First corner of the screenshot rectangle (DIP). */
  ScreenshotCornerA: ClickCoordinatesResult | null = null;
  /** Opposite corner of the screenshot rectangle (DIP). */
  ScreenshotCornerB: ClickCoordinatesResult | null = null;
  SRCBASE64: string = "";
  PrintedText: string = "";

  async GetCords() {
    const pos = await this.electronHelper.waitForNextClickCoordinates({
      timeoutMs: 60_000,
      button: 'left',
    });
    this.PrintedCords = `X: ${pos.x}, Y: ${pos.y}`;
    this.ToClickCords = pos;
  }

  async ClickCords() {
    if (this.ToClickCords) {
      await this.electronHelper.moveMouseThenClick(this.ToClickCords.x, this.ToClickCords.y, "left");
    }
  }

  async PickScreenshotCornerA() {
    const pos = await this.electronHelper.waitForNextClickCoordinates({
      timeoutMs: 60_000,
      button: 'left',
    });
    this.ScreenshotCornerA = pos;
  }

  async PickScreenshotCornerB() {
    const pos = await this.electronHelper.waitForNextClickCoordinates({
      timeoutMs: 60_000,
      button: 'left',
    });
    this.ScreenshotCornerB = pos;
  }

  async TakeScreenshot() {
    const a = this.ScreenshotCornerA;
    const b = this.ScreenshotCornerB;
    if (!a || !b) {
      return;
    }
    const shot = await this.electronHelper.takeFullScreenshot(a.x, a.y, b.x, b.y);
    this.SRCBASE64 = `data:image/png;base64,${shot.base64}`;
  }

  async GetText(){
    const text = await this.electronHelper.recognizeTextFromImageBase64(this.SRCBASE64);
    this.PrintedText = text;
  }
}

