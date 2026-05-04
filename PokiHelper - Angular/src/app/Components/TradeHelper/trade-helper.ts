import { Component } from '@angular/core';
import { ElectronHelper } from '../../Services/electron-helper';

@Component({
  selector: 'app-trade-helper',
  imports: [],
  templateUrl: './trade-helper.html',
  styleUrl: './trade-helper.css',
})

export class TradeHelper {

  constructor(private electronHelper: ElectronHelper){}

  async TypeHello(){
    setTimeout(async () => {
      this.electronHelper.typeText('Hello');
    }, 1000);
  }
}


