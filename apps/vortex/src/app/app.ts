import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  parseVortexBlotterNumericValue,
  type VortexBlotterRowStyleRule,
  VortexBlotter,
} from 'vortex-blotter';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VortexBlotter],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** Demo: row styles with semantic font size / weight (built-in demo table columns). */
  readonly blotterRowStyles: VortexBlotterRowStyleRule[] = [
    {
      column: 'notional',
      match: (v) => {
        const n = parseVortexBlotterNumericValue(v);
        const  vl = n !== null && n > 250000;
        console.log('notional', v, n, vl);
        return vl;
      },
      backgroundColor: 'lightblue',
      color: 'darkblue',
      fontSize: 'large',
      fontWeight: 'extra-bold',
      order: 0
    },
    {
      column: 'side',
      match: (v) => v === 'BUY',
      backgroundColor: 'rgba(20, 100, 60, 0.35)',
      color: '#bbf7d0',
      fontSize: 'regular',
      fontWeight: 'light',
      order: 1
    },
  ];
}
