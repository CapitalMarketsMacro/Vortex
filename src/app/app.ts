import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { type VortexBlotterRowStyleRule, VortexBlotter } from 'vortex-blotter';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VortexBlotter],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** Demo: highlight rows by `Side` (matches built-in demo table columns). */
  readonly blotterRowStyles: VortexBlotterRowStyleRule[] = [
    {
      column: 'Side',
      match: (v) => v === 'SELL',
      backgroundColor: 'rgba(180, 40, 40, 0.35)',
      color: '#fecaca',
    },
    {
      column: 'Side',
      match: (v) => v === 'BUY',
      backgroundColor: 'rgba(20, 100, 60, 0.35)',
      color: '#bbf7d0',
    },
  ];
}
