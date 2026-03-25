import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VortexBlotter } from 'vortex-blotter';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VortexBlotter],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
