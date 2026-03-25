import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  viewChild,
} from '@angular/core';
import perspective from '@perspective-dev/client';
import '@perspective-dev/viewer-datagrid';
import '@perspective-dev/viewer-d3fc';

/** Sample rows for the blotter until a live feed is wired. */
const BLOTTER_SAMPLE = [
  {
    Symbol: 'AAPL',
    Side: 'BUY',
    Quantity: 100,
    Price: 189.5,
    Time: new Date().toISOString(),
  },
  {
    Symbol: 'MSFT',
    Side: 'SELL',
    Quantity: 50,
    Price: 415.2,
    Time: new Date().toISOString(),
  },
  {
    Symbol: 'NVDA',
    Side: 'BUY',
    Quantity: 25,
    Price: 892.1,
    Time: new Date().toISOString(),
  },
];

type PerspectiveViewerEl = HTMLElement & {
  load: (table: unknown) => Promise<void>;
};

@Component({
  selector: 'vortex-blotter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './vortex-blotter.html',
  styleUrl: './vortex-blotter.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class VortexBlotter implements AfterViewInit {
  private readonly viewerRef = viewChild<ElementRef<HTMLElement>>('viewer');

  async ngAfterViewInit(): Promise<void> {
    const host = this.viewerRef()?.nativeElement;
    if (!host || typeof (host as PerspectiveViewerEl).load !== 'function') {
      return;
    }
    const viewer = host as PerspectiveViewerEl;
    try {
      const worker = await perspective.worker();
      const table = await worker.table(BLOTTER_SAMPLE);
      await viewer.load(table);
    } catch (err) {
      console.warn('VortexBlotter: failed to attach Perspective table', err);
    }
  }
}
