import { Component } from '@angular/core';
import { ElectronHelper } from '../../Services/electron-helper';
import { ClickCoordinatesResult } from '../../../poki-helper-preload';
import { NzTabsModule } from 'ng-zorro-antd/tabs';

@Component({
  selector: 'app-trade-helper',
  imports: [NzTabsModule],
  templateUrl: './trade-helper.html',
  styleUrl: './trade-helper.css',
})

export class TradeHelper {

  constructor(
    private electronHelper: ElectronHelper,
  ) { }

}

