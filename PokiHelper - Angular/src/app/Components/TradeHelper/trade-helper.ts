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

  constructor(private electronHelper: ElectronHelper) { }

  PrintedCords: string = "";
  ToClickCords: ClickCoordinatesResult | null = null;

  async GetCords() {
    const pos = await this.electronHelper.waitForNextClickCoordinates({
      timeoutMs: 60_000,
      button: 'left',
    });
    this.PrintedCords = `X: ${pos.x}, Y: ${pos.y}`;
    this.ToClickCords = pos;
  }

  async ClickCords() {
    if(this.ToClickCords){
      await this.electronHelper.moveMouseThenClick(this.ToClickCords.x, this.ToClickCords.y, "left");
    }
  }
}


