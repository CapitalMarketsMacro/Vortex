import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Table } from '@perspective-dev/client';
import perspective from '@perspective-dev/client';
import '@perspective-dev/viewer-datagrid';
import '@perspective-dev/viewer-d3fc';

import {
  attachVortexBlotterRowStyles,
  type VortexBlotterRowStyleRule,
} from './perspective-row-styles';
import {
  draftsToStyleRules,
  type VortexBlotterRowEditorDraft,
  type VortexBlotterRowStyleConditionOp,
} from './row-style-editor';

export {
  attachVortexBlotterRowStyles,
  parseVortexBlotterNumericValue,
  resolveVortexBlotterFontSize,
  resolveVortexBlotterFontWeight,
} from './perspective-row-styles';
export type {
  VortexBlotterRowFontSizePreset,
  VortexBlotterRowFontWeightPreset,
  VortexBlotterRowStyleRule,
} from './perspective-row-styles';
export type {
  VortexBlotterRowEditorDraft,
  VortexBlotterRowStyleConditionOp,
} from './row-style-editor';

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
  private static editorRowSeq = 0;
  private readonly fieldUid = `vb-${VortexBlotter.idSeq++}`;
  readonly wsInputId = `vortex-blotter-ws-${this.fieldUid}`;
  readonly wsDatalistId = `vortex-blotter-ws-dl-${this.fieldUid}`;
  readonly tableInputId = `vortex-blotter-table-${this.fieldUid}`;
  readonly tableDatalistId = `vortex-blotter-table-dl-${this.fieldUid}`;
  readonly rowStyleEditorTitleId = `vortex-blotter-row-style-title-${this.fieldUid}`;
  readonly rowStyleEditorPanelId = `vortex-blotter-row-style-panel-${this.fieldUid}`;
  /** Shared datalist id for column name suggestions (from `Table.columns()`). */
  readonly tableColumnDatalistId = `vortex-blotter-cols-${this.fieldUid}`;

  /** Hosted table name on the Perspective server; optional if using demo + local controls. */
  readonly tableName = input<string>('');

  /** WebSocket URL to the Perspective server; optional if using demo + local controls. */
  readonly websocketUrl = input<string>('');

  /**
   * Programmatic row style rules. Merged with rules applied from the Row style editor
   * (settings control). When several rules match, higher `order` wins (see
   * `VortexBlotterRowStyleRule.order`).
   */
  readonly rowStyleRules = input<VortexBlotterRowStyleRule[]>([]);

  readonly wsUrlOptions = [
    'http://localhost:8080/websocket',
    'ws://localhost:8080/ws',
    'ws://127.0.0.1:8080/websocket',
  ] as const;

  readonly tableNameOptions = ['fx_executions', 'demo', 'main'] as const;

  readonly conditionOpOptions: {
    value: VortexBlotterRowStyleConditionOp;
    label: string;
  }[] = [
    { value: 'eq', label: 'Equals' },
    { value: 'neq', label: 'Not equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater or equal' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less or equal' },
  ];

  readonly editorFontSizeOptions: (VortexBlotterRowEditorDraft['fontSize'])[] = [
    '',
    'smaller',
    'small',
    'regular',
    'large',
    'extraLarge',
    'xtraLarge',
    'xtraLarger',
  ];

  readonly editorFontWeightOptions: (VortexBlotterRowEditorDraft['fontWeight'])[] =
    [
      '',
      'thin',
      'light',
      'regular',
      'medium',
      'semiBold',
      'bold',
      'extraBold',
      'black',
    ];

  private readonly viewerRef = viewChild<ElementRef<HTMLElement>>('viewer');

  readonly rowStyleEditorOpen = signal(false);

  /** In-memory editor rows (with stable `id` for `@for` tracking). */
  readonly editorRows = signal<
    (VortexBlotterRowEditorDraft & { id: string })[]
  >([]);

  /** Rules compiled from the editor when the user clicks Apply. */
  private readonly appliedEditorRules = signal<VortexBlotterRowStyleRule[]>([]);

  private readonly mergedRowStyleRules = computed(() => [
    ...this.rowStyleRules(),
    ...this.appliedEditorRules(),
  ]);

  /** Current Perspective table after a successful `viewer.load` (for row styling). */
  private readonly loadedTable = signal<Table | null>(null);

  /**
   * Column names from the loaded Perspective `Table` (`await table.columns()`), for the
   * row style editor. Empty when no table is loaded or columns could not be read.
   */
  readonly tableColumnNames = signal<string[]>([]);

  private readonly destroyRef = inject(DestroyRef);
  private rowStyleCleanup: (() => Promise<void>) | null = null;

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

  readonly columnFieldPlaceholder = computed(() =>
    this.tableColumnNames().length > 0
      ? 'Choose from list or type'
      : 'Load a table for suggestions',
  );

  private loadSeq = 0;
  private columnsLoadSeq = 0;

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
        this.loadedTable.set(null);
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

    effect(() => {
      const rules = this.mergedRowStyleRules();
      const viewer = this.viewerRef()?.nativeElement;
      const tbl = this.loadedTable();
      if (!viewer || !tbl) {
        void this.disposeRowStyles();
        return;
      }
      void this.syncRowStyles(viewer, tbl, rules);
    });

    effect(() => {
      const tbl = this.loadedTable();
      void this.refreshTableColumnNames(tbl);
    });

    this.destroyRef.onDestroy(() => {
      void this.disposeRowStyles();
    });
  }

  private async disposeRowStyles(): Promise<void> {
    if (this.rowStyleCleanup) {
      await this.rowStyleCleanup();
      this.rowStyleCleanup = null;
    }
  }

  private async refreshTableColumnNames(table: Table | null): Promise<void> {
    const seq = ++this.columnsLoadSeq;
    if (!table) {
      if (seq === this.columnsLoadSeq) {
        this.tableColumnNames.set([]);
      }
      return;
    }
    try {
      const cols = await table.columns();
      if (seq !== this.columnsLoadSeq) {
        return;
      }
      const names = Array.isArray(cols) ? cols.map((c) => String(c)) : [];
      this.tableColumnNames.set(names);
    } catch {
      if (seq === this.columnsLoadSeq) {
        this.tableColumnNames.set([]);
      }
    }
  }

  private async syncRowStyles(
    viewer: HTMLElement,
    table: Table,
    rules: VortexBlotterRowStyleRule[],
  ): Promise<void> {
    await this.disposeRowStyles();
    if (rules.length === 0) {
      return;
    }
    this.rowStyleCleanup = attachVortexBlotterRowStyles(viewer, table, rules);
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

  openRowStyleEditor(): void {
    if (this.editorRows().length === 0) {
      this.editorRows.set([this.newEditorRow()]);
    }
    this.rowStyleEditorOpen.set(true);
  }

  closeRowStyleEditor(): void {
    this.rowStyleEditorOpen.set(false);
  }

  applyRowStyleEditor(): void {
    this.appliedEditorRules.set(draftsToStyleRules(this.editorRows()));
  }

  clearAppliedEditorRules(): void {
    this.appliedEditorRules.set([]);
  }

  addEditorRow(): void {
    this.editorRows.update((rows) => [...rows, this.newEditorRow()]);
  }

  removeEditorRow(id: string): void {
    this.editorRows.update((rows) => rows.filter((r) => r.id !== id));
  }

  patchEditorRow(id: string, patch: Partial<VortexBlotterRowEditorDraft>): void {
    this.editorRows.update((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  onEditorColumnInput(id: string, event: Event): void {
    this.patchEditorRow(id, {
      column: (event.target as HTMLInputElement).value,
    });
  }

  onEditorValueInput(id: string, event: Event): void {
    this.patchEditorRow(id, {
      value: (event.target as HTMLInputElement).value,
    });
  }

  onEditorOrderInput(id: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const n = Number(raw);
    this.patchEditorRow(id, {
      order: raw === '' || Number.isNaN(n) ? 0 : n,
    });
  }

  onEditorBgInput(id: string, event: Event): void {
    this.patchEditorRow(id, {
      backgroundColor: (event.target as HTMLInputElement).value,
    });
  }

  onEditorFgInput(id: string, event: Event): void {
    this.patchEditorRow(id, {
      color: (event.target as HTMLInputElement).value,
    });
  }

  onEditorOpChange(id: string, event: Event): void {
    this.patchEditorRow(id, {
      op: (event.target as HTMLSelectElement).value as VortexBlotterRowStyleConditionOp,
    });
  }

  onEditorFontSizeChange(id: string, event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.patchEditorRow(id, {
      fontSize: v as VortexBlotterRowEditorDraft['fontSize'],
    });
  }

  onEditorFontWeightChange(id: string, event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.patchEditorRow(id, {
      fontWeight: v as VortexBlotterRowEditorDraft['fontWeight'],
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.rowStyleEditorOpen()) {
      event.preventDefault();
      this.closeRowStyleEditor();
    }
  }

  private newEditorRow(): VortexBlotterRowEditorDraft & { id: string } {
    return {
      id: `vb-er-${VortexBlotter.editorRowSeq++}`,
      column: '',
      op: 'eq',
      value: '',
      order: 100,
      backgroundColor: '',
      color: '',
      fontSize: '',
      fontWeight: '',
    };
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
    this.loadedTable.set(null);

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

      this.loadedTable.set(table);
      this.demoHint.set(DEMO_HINT);
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.loadError.set(message);
      this.loadedTable.set(null);
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
    this.loadedTable.set(null);

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
      if (seq !== this.loadSeq) {
        return;
      }

      this.loadedTable.set(table);
    } catch (err) {
      if (seq !== this.loadSeq) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.loadError.set(message);
      this.loadedTable.set(null);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
