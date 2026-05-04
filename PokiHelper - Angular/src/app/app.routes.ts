import { Routes } from '@angular/router';
import { TradeHelper } from './Components/TradeHelper/trade-helper';

export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'TradeHelper' },
    { path: 'TradeHelper', component: TradeHelper },
];
