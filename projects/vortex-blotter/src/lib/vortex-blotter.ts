import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import perspective from '@perspective-dev/client';
import '@perspective-dev/viewer-datagrid';
import '@perspective-dev/viewer-d3fc';

type PerspectiveViewerEl = HTMLElement & {
  load: (table: unknown) => Promise<void>;
};

const DEMO_ROWS = [
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

const DEMO_HINT =
  'Demo data is shown. Type or pick a WebSocket URL and table name below, then connect—or pass tableName and websocketUrl from the parent.';

@Component({
  selector: 'vortex-blotter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './vortex-blotter.html',
  styleUrl: './vortex-blotter.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class VortexBlotter {
  private static idSeq = 0;
  private readonly fieldUid = `vb-${VortexBlotter.idSeq++}`;
  readonly wsInputId = `vortex-blotter-ws-${this.fieldUid}`;
  readonly wsDatalistId = `vortex-blotter-ws-dl-${this.fieldUid}`;
  readonly tableInputId = `vortex-blotter-table-${this.fieldUid}`;
  readonly tableDatalistId = `vortex-blotter-table-dl-${this.fieldUid}`;

  /** Hosted table name on the Perspective server; optional if using demo + local controls. */
  readonly tableName = input<string>('');

  /** WebSocket URL to the Perspective server; optional if using demo + local controls. */
  readonly websocketUrl = input<string>('');

  readonly wsUrlOptions = [
    'http://localhost:8080/websocket',
    'ws://localhost:8080/ws',
    'ws://127.0.0.1:8080/websocket',
  ] as const;

  readonly tableNameOptions = ['fx_executions', 'demo', 'main'] as const;

  private readonly viewerRef = viewChild<ElementRef<HTMLElement>>('viewer');

  readonly internalUrl = signal('http://localhost:8080/websocket');
  readonly internalTable = signal('fx_executions');
  /** When true, load from internalUrl/internalTable instead of demo rows. */
  readonly internalLive = signal(false);

  readonly loadError = signal<string | null>(null);
  readonly demoHint = signal<string | null>(null);
  readonly loading = signal(false);

  readonly hasParentConfig = computed(() => {
    const n = this.tableName().trim();
    const u = this.websocketUrl().trim();
    return n.length > 0 && u.length > 0;
  });

  readonly statusBadge = computed(() => {
    if (this.loading()) {
      return 'Connecting';
    }
    if (this.hasParentConfig() || this.internalLive()) {
      return 'Live';
    }
    if (this.demoHint()) {
      return 'Demo';
    }
    return 'Live';
  });

  private loadSeq = 0;

  constructor() {
    effect(() => {
      const ref = this.viewerRef();
      const host = ref?.nativeElement;
      if (!host || typeof (host as PerspectiveViewerEl).load !== 'function') {
        return;
      }

      const viewer = host as PerspectiveViewerEl;
      const parentName = this.tableName().trim();
      const parentUrl = this.websocketUrl().trim();
      const hasBothParent = parentName.length > 0 && parentUrl.length > 0;
      const partialParent =
        (parentName.length > 0) !== (parentUrl.length > 0);

      if (partialParent) {
        this.loadSeq += 1;
        this.loadError.set(
          'Provide both tableName and websocketUrl for a live server, or omit both for demo data.',
        );
        this.demoHint.set(null);
        return;
      }

      if (hasBothParent) {
        this.loadError.set(null);
        void this.bindRemoteTable(
          viewer,
          parentName,
          this.toWebSocketUrl(parentUrl),
        );
        return;
      }

      if (!this.internalLive()) {
        void this.loadDemoTable(viewer);
        return;
      }

      this.loadError.set(null);
      void this.bindRemoteTable(
        viewer,
        this.internalTable().trim(),
        this.toWebSocketUrl(this.internalUrl()),
      );
    });
  }

  connectFromPicker(): void {
    this.internalLive.set(true);
  }

  onWsInput(event: Event): void {
    this.internalUrl.set((event.target as HTMLInputElement).value);
  }

  onTableInput(event: Event): void {
    this.internalTable.set((event.target as HTMLInputElement).value);
  }

  private toWebSocketUrl(url: string): string {
    const t = url.trim();
    if (t.startsWith('https://')) {
      return 'wss://' + t.slice('https://'.length);
    }
    if (t.startsWith('http://')) {
      return 'ws://' + t.slice('http://'.length);
    }
    return t;
  }

  private async loadDemoTable(viewer: PerspectiveViewerEl): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    this.demoHint.set(null);

    try {
      const worker = await perspective.worker();
      if (seq !== this.loadSeq) {
        return;
      }

      const table = await worker.table(DEMO_ROWS);
      if (seq !== this.loadSeq) {
        return;
      }

      await viewer.load(table);
      if (seq !== this.loadSeq) {
        return;
      }

      this.demoHint.set(DEMO_HINT);
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.loadError.set(message);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async bindRemoteTable(
    viewer: PerspectiveViewerEl,
    name: string,
    wsUrl: string,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(null);
    this.demoHint.set(null);

    try {
      const client = await perspective.websocket(wsUrl);
      if (seq !== this.loadSeq) {
        return;
      }

      const table = await client.open_table(name);
      if (seq !== this.loadSeq) {
        return;
      }

      await viewer.load(table);
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.loadError.set(message);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
