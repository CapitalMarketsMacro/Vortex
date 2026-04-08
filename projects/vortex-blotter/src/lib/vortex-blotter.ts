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
  deleteLayoutFromStorage,
  listLayoutNames,
  loadLayoutFromStorage,
  sanitizeLayoutName,
  saveLayoutToStorage,
  type VortexBlotterSavedLayoutV1,
} from './layout-storage';
import { attachVortexBlotterColumnHeaderLabels } from './perspective-column-headers';
import {
  attachVortexBlotterRowStyles,
  type VortexBlotterRowStyleRule,
} from './perspective-row-styles';
import {
  applyPerspectiveLayoutToken,
  clonePerspectiveTokenForJson,
} from './perspective-layout-token';
import {
  injectVortexCustomPerspectiveThemesCss,
  REGISTERED_PERSPECTIVE_THEME_NAMES,
} from './perspective-theme-css';
import {
  parseVortexPerspectiveThemeChoice,
  PERSPECTIVE_VIEWER_THEME_ATTR,
  type VortexPerspectiveThemeChoice,
  VORTEX_PERSPECTIVE_THEME_STORAGE_KEY,
} from './perspective-theme-tokens';
import {
  draftsToStyleRules,
  type VortexBlotterRowEditorDraft,
  type VortexBlotterRowStyleConditionOp,
} from './row-style-editor';

function readStoredPerspectiveTheme(): VortexPerspectiveThemeChoice {
  if (typeof localStorage === 'undefined') {
    return 'pro-dark';
  }
  try {
    const v = localStorage.getItem(VORTEX_PERSPECTIVE_THEME_STORAGE_KEY);
    return parseVortexPerspectiveThemeChoice(v) ?? 'pro-dark';
  } catch {
    /* ignore */
  }
  return 'pro-dark';
}

function persistPerspectiveThemeChoice(choice: VortexPerspectiveThemeChoice): void {
  try {
    localStorage.setItem(VORTEX_PERSPECTIVE_THEME_STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
}

export {
  isVortexBlotterSavedLayoutV1,
  VORTEX_BLOTTER_LAYOUTS_STORAGE_KEY,
  deleteLayoutFromStorage,
  listLayoutNames,
  loadLayoutFromStorage,
  readLayoutMap,
  sanitizeLayoutName,
  saveLayoutToStorage,
} from './layout-storage';
export type { VortexBlotterSavedLayoutV1 } from './layout-storage';
export { attachVortexBlotterColumnHeaderLabels } from './perspective-column-headers';
export {
  attachVortexBlotterRowStyles,
  findPerspectiveDatagrid,
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
  save?: () => Promise<unknown>;
  restore?: (config: unknown) => Promise<unknown>;
  resize?: (force?: boolean | null) => Promise<unknown>;
  resetThemes?: (names: readonly string[]) => Promise<unknown>;
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
  private static columnHeaderRowSeq = 0;
  private readonly fieldUid = `vb-${VortexBlotter.idSeq++}`;
  readonly wsInputId = `vortex-blotter-ws-${this.fieldUid}`;
  readonly wsDatalistId = `vortex-blotter-ws-dl-${this.fieldUid}`;
  readonly tableInputId = `vortex-blotter-table-${this.fieldUid}`;
  readonly tableDatalistId = `vortex-blotter-table-dl-${this.fieldUid}`;
  readonly rowStyleEditorTitleId = `vortex-blotter-row-style-title-${this.fieldUid}`;
  readonly rowStyleEditorPanelId = `vortex-blotter-row-style-panel-${this.fieldUid}`;
  readonly columnHeaderEditorTitleId = `vortex-blotter-col-headers-title-${this.fieldUid}`;
  readonly columnHeaderEditorPanelId = `vortex-blotter-col-headers-panel-${this.fieldUid}`;
  /** Shared datalist id for column name suggestions (from `Table.columns()`). */
  readonly tableColumnDatalistId = `vortex-blotter-cols-${this.fieldUid}`;
  readonly layoutManagerTitleId = `vortex-blotter-layouts-title-${this.fieldUid}`;
  readonly layoutManagerPanelId = `vortex-blotter-layouts-panel-${this.fieldUid}`;
  readonly layoutManagerNameInputId = `vortex-blotter-layout-name-${this.fieldUid}`;
  readonly toolbarDetailsPanelId = `vortex-blotter-toolbar-details-${this.fieldUid}`;
  readonly themeSelectId = `vortex-blotter-theme-${this.fieldUid}`;

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

  /**
   * Friendly display names for data column headers (keys = schema column names from
   * `Table.columns()`). Merged with labels applied from the column header editor.
   */
  readonly columnHeaderLabels = input<Record<string, string>>({});

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

  readonly editorFontSizeOptions: VortexBlotterRowEditorDraft['fontSize'][] = [
    '',
    'smaller',
    'small',
    'regular',
    'large',
    'extraLarge',
    'xtraLarge',
    'xtraLarger',
  ];

  readonly editorFontWeightOptions: VortexBlotterRowEditorDraft['fontWeight'][] = [
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
  readonly editorRows = signal<(VortexBlotterRowEditorDraft & { id: string })[]>([]);

  /** Rules compiled from the editor when the user clicks Apply. */
  private readonly appliedEditorRules = signal<VortexBlotterRowStyleRule[]>([]);

  private readonly mergedRowStyleRules = computed(() => [
    ...this.rowStyleRules(),
    ...this.appliedEditorRules(),
  ]);

  /** Labels from the column header editor (Apply). */
  private readonly appliedColumnHeaderLabels = signal<Record<string, string>>({});

  private readonly mergedColumnHeaderLabels = computed(() => ({
    ...this.columnHeaderLabels(),
    ...this.appliedColumnHeaderLabels(),
  }));

  /** Current Perspective table after a successful `viewer.load` (for row styling). */
  private readonly loadedTable = signal<Table | null>(null);

  /**
   * Column names from the loaded Perspective `Table` (`await table.columns()`), for the
   * row style editor. Empty when no table is loaded or columns could not be read.
   */
  readonly tableColumnNames = signal<string[]>([]);

  private readonly destroyRef = inject(DestroyRef);
  private rowStyleCleanup: (() => Promise<void>) | null = null;
  private columnHeaderCleanup: (() => Promise<void>) | null = null;

  readonly columnHeaderEditorOpen = signal(false);

  readonly columnHeaderRows = signal<{ id: string; columnKey: string; displayName: string }[]>([]);

  readonly layoutManagerOpen = signal(false);
  readonly layoutSaveName = signal('');
  readonly layoutStatusMessage = signal<string | null>(null);
  readonly savedLayoutNames = signal<string[]>([]);

  /** Top toolbar (connection fields, hints) expanded vs one-line title + actions. */
  readonly toolbarExpanded = signal(true);

  /** Perspective `theme` attribute: Pro Dark (default), Carbon, or Neo Quantum. */
  readonly perspectiveThemeChoice = signal<VortexPerspectiveThemeChoice>('pro-dark');

  readonly internalUrl = signal('http://localhost:4000/ws');
  readonly internalTable = signal('RatesMarketData');
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

  readonly toolbarToggleAriaLabel = computed(() =>
    this.toolbarExpanded() ? 'Collapse toolbar' : 'Expand toolbar',
  );

  readonly perspectiveViewerThemeAttr = computed(
    () => PERSPECTIVE_VIEWER_THEME_ATTR[this.perspectiveThemeChoice()],
  );

  readonly columnFieldPlaceholder = computed(() =>
    this.tableColumnNames().length > 0
      ? 'Choose from list or type'
      : 'Load a table for suggestions',
  );

  private loadSeq = 0;
  private columnsLoadSeq = 0;

  private perspectiveThemesRegistered = false;

  constructor() {
    injectVortexCustomPerspectiveThemesCss();
    this.perspectiveThemeChoice.set(readStoredPerspectiveTheme());

    effect(() => {
      const host = this.viewerRef()?.nativeElement;
      if (!host || this.perspectiveThemesRegistered) {
        return;
      }
      void this.registerPerspectiveThemeList(host as PerspectiveViewerEl);
    });

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
      const partialParent = parentName.length > 0 !== parentUrl.length > 0;

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
        void this.bindRemoteTable(viewer, parentName, this.toWebSocketUrl(parentUrl));
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

    effect(() => {
      const labels = this.mergedColumnHeaderLabels();
      const viewer = this.viewerRef()?.nativeElement;
      const tbl = this.loadedTable();
      if (!viewer || !tbl) {
        void this.disposeColumnHeaderLabels();
        return;
      }
      void this.syncColumnHeaderLabels(viewer, tbl, labels);
    });

    this.destroyRef.onDestroy(() => {
      void this.disposeRowStyles();
      void this.disposeColumnHeaderLabels();
    });
  }

  private async disposeRowStyles(): Promise<void> {
    if (this.rowStyleCleanup) {
      await this.rowStyleCleanup();
      this.rowStyleCleanup = null;
    }
  }

  private async disposeColumnHeaderLabels(): Promise<void> {
    if (this.columnHeaderCleanup) {
      await this.columnHeaderCleanup();
      this.columnHeaderCleanup = null;
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

  private async syncColumnHeaderLabels(
    viewer: HTMLElement,
    table: Table,
    labels: Record<string, string>,
  ): Promise<void> {
    await this.disposeColumnHeaderLabels();
    if (Object.keys(labels).length === 0) {
      return;
    }
    this.columnHeaderCleanup = attachVortexBlotterColumnHeaderLabels(viewer, table, labels);
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

  toggleToolbar(): void {
    this.toolbarExpanded.update((v) => !v);
  }

  onPerspectiveThemeChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value as VortexPerspectiveThemeChoice;
    if (v !== 'pro-dark' && v !== 'carbon' && v !== 'neo-quantum') {
      return;
    }
    this.perspectiveThemeChoice.set(v);
    persistPerspectiveThemeChoice(v);
  }

  private async registerPerspectiveThemeList(viewer: PerspectiveViewerEl): Promise<void> {
    if (this.perspectiveThemesRegistered) {
      return;
    }
    if (typeof customElements === 'undefined') {
      return;
    }
    await customElements.whenDefined('perspective-viewer');
    injectVortexCustomPerspectiveThemesCss();
    for (let i = 0; i < 24; i++) {
      if (typeof viewer.resetThemes === 'function') {
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    if (typeof viewer.resetThemes !== 'function') {
      return;
    }
    try {
      await viewer.resetThemes([...REGISTERED_PERSPECTIVE_THEME_NAMES]);
      this.perspectiveThemesRegistered = true;
    } catch {
      /* ignore */
    }
  }

  openRowStyleEditor(): void {
    this.layoutManagerOpen.set(false);
    this.columnHeaderEditorOpen.set(false);
    if (this.editorRows().length === 0) {
      this.editorRows.set([this.newEditorRow()]);
    }
    this.rowStyleEditorOpen.set(true);
  }

  closeRowStyleEditor(): void {
    this.rowStyleEditorOpen.set(false);
  }

  openColumnHeaderEditor(): void {
    this.layoutManagerOpen.set(false);
    this.rowStyleEditorOpen.set(false);
    if (this.columnHeaderRows().length === 0) {
      this.columnHeaderRows.set([this.newColumnHeaderRow()]);
    }
    this.columnHeaderEditorOpen.set(true);
  }

  closeColumnHeaderEditor(): void {
    this.columnHeaderEditorOpen.set(false);
  }

  openLayoutManager(): void {
    this.rowStyleEditorOpen.set(false);
    this.columnHeaderEditorOpen.set(false);
    this.layoutStatusMessage.set(null);
    this.refreshSavedLayoutNames();
    this.layoutManagerOpen.set(true);
  }

  closeLayoutManager(): void {
    this.layoutManagerOpen.set(false);
  }

  onLayoutSaveNameInput(event: Event): void {
    this.layoutSaveName.set((event.target as HTMLInputElement).value);
  }

  refreshSavedLayoutNames(): void {
    this.savedLayoutNames.set(listLayoutNames());
  }

  async saveCurrentLayoutToStorage(): Promise<void> {
    this.layoutStatusMessage.set(null);
    const name = sanitizeLayoutName(this.layoutSaveName());
    if (!name) {
      this.layoutStatusMessage.set('Enter a name for this layout.');
      return;
    }
    try {
      const snapshot = await this.collectLayoutSnapshot();
      saveLayoutToStorage(name, snapshot);
      this.refreshSavedLayoutNames();
      this.layoutStatusMessage.set(`Saved layout “${name}”.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.layoutStatusMessage.set(msg);
    }
  }

  async loadLayoutByName(name: string): Promise<void> {
    this.layoutStatusMessage.set(null);
    const layout = loadLayoutFromStorage(name);
    if (!layout) {
      this.layoutStatusMessage.set(`Layout “${name}” was not found.`);
      this.refreshSavedLayoutNames();
      return;
    }
    try {
      const perspectiveFailed = await this.applyLayoutSnapshot(layout);
      this.layoutStatusMessage.set(
        perspectiveFailed
          ? `Loaded “${name}” (row styles & headers; saved Perspective view could not be restored).`
          : `Loaded layout “${name}”.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.layoutStatusMessage.set(msg);
    }
  }

  deleteLayoutByName(name: string): void {
    this.layoutStatusMessage.set(null);
    deleteLayoutFromStorage(name);
    this.refreshSavedLayoutNames();
    this.layoutStatusMessage.set(`Removed layout “${name}”.`);
  }

  private async collectLayoutSnapshot(): Promise<VortexBlotterSavedLayoutV1> {
    const viewer = this.viewerRef()?.nativeElement as PerspectiveViewerEl | undefined;
    let perspective: unknown = null;
    if (viewer && typeof viewer.save === 'function') {
      try {
        const raw = await viewer.save();
        perspective = clonePerspectiveTokenForJson(raw);
      } catch {
        perspective = null;
      }
    }
    const rowStyleEditorRows = this.editorRows().map(({ id: _id, ...rest }) => rest);
    const columnHeaderRows = this.columnHeaderRows().map(({ id: _id, ...rest }) => rest);
    return {
      version: 1,
      perspective,
      rowStyleEditorRows,
      columnHeaderRows,
      perspectiveTheme: this.perspectiveThemeChoice(),
    };
  }

  /**
   * @returns `true` if Perspective `restore` was attempted but failed (row styles still apply).
   * @see https://perspective-dev.github.io/guide/how_to/javascript/save_restore.html
   */
  private async applyLayoutSnapshot(layout: VortexBlotterSavedLayoutV1): Promise<boolean> {
    const viewer = this.viewerRef()?.nativeElement as PerspectiveViewerEl | undefined;
    let perspectiveFailed = false;
    if (viewer && layout.perspective != null) {
      perspectiveFailed = await applyPerspectiveLayoutToken(
        viewer,
        layout.perspective,
        this.loadedTable(),
      );
    }

    const savedTheme = parseVortexPerspectiveThemeChoice(layout.perspectiveTheme);
    if (savedTheme !== undefined) {
      this.perspectiveThemeChoice.set(savedTheme);
      persistPerspectiveThemeChoice(savedTheme);
    }

    this.editorRows.set(
      layout.rowStyleEditorRows.map((d) => ({
        ...d,
        id: `vb-er-${VortexBlotter.editorRowSeq++}`,
      })),
    );
    this.columnHeaderRows.set(
      layout.columnHeaderRows.map((r) => ({
        ...r,
        id: `vb-ch-${VortexBlotter.columnHeaderRowSeq++}`,
      })),
    );
    this.applyRowStyleEditor();
    this.applyColumnHeaderEditor();
    return perspectiveFailed;
  }

  applyColumnHeaderEditor(): void {
    this.appliedColumnHeaderLabels.set(this.columnHeaderRowsToRecord());
  }

  clearAppliedColumnHeaderLabels(): void {
    this.appliedColumnHeaderLabels.set({});
  }

  seedColumnHeaderRowsFromTable(): void {
    const cols = this.tableColumnNames();
    if (cols.length === 0) {
      return;
    }
    this.columnHeaderRows.set(
      cols.map((c) => ({
        id: `vb-ch-${VortexBlotter.columnHeaderRowSeq++}`,
        columnKey: c,
        displayName: c,
      })),
    );
  }

  addColumnHeaderRow(): void {
    this.columnHeaderRows.update((rows) => [...rows, this.newColumnHeaderRow()]);
  }

  removeColumnHeaderRow(id: string): void {
    this.columnHeaderRows.update((rows) => rows.filter((r) => r.id !== id));
  }

  patchColumnHeaderRow(
    id: string,
    patch: Partial<{ columnKey: string; displayName: string }>,
  ): void {
    this.columnHeaderRows.update((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  onColumnHeaderKeyInput(id: string, event: Event): void {
    this.patchColumnHeaderRow(id, {
      columnKey: (event.target as HTMLInputElement).value,
    });
  }

  onColumnHeaderDisplayInput(id: string, event: Event): void {
    this.patchColumnHeaderRow(id, {
      displayName: (event.target as HTMLInputElement).value,
    });
  }

  private columnHeaderRowsToRecord(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const r of this.columnHeaderRows()) {
      const k = r.columnKey.trim();
      const d = r.displayName.trim();
      if (k && d) {
        out[k] = d;
      }
    }
    return out;
  }

  private newColumnHeaderRow(): {
    id: string;
    columnKey: string;
    displayName: string;
  } {
    return {
      id: `vb-ch-${VortexBlotter.columnHeaderRowSeq++}`,
      columnKey: '',
      displayName: '',
    };
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
    this.editorRows.update((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
    if (event.key !== 'Escape') {
      return;
    }
    if (this.layoutManagerOpen()) {
      event.preventDefault();
      this.closeLayoutManager();
      return;
    }
    if (this.columnHeaderEditorOpen()) {
      event.preventDefault();
      this.closeColumnHeaderEditor();
      return;
    }
    if (this.rowStyleEditorOpen()) {
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
