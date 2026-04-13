import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import type { Table } from '@perspective-dev/client';
import perspective from '@perspective-dev/client';
import '@perspective-dev/viewer-datagrid';
import '@perspective-dev/viewer-d3fc';

import {
  attachVortexBlotterColumnHeaderLabels,
  attachVortexBlotterRowStyles,
  applyPerspectiveLayoutToken,
  clonePerspectiveTokenForJson,
  deleteLayoutFromStorage,
  draftsToStyleRules,
  injectVortexCustomPerspectiveThemesCss,
  listLayoutNames,
  loadLayoutFromStorage,
  parseTablesListResponse,
  parseVortexPerspectiveThemeChoice,
  persistPerspectiveThemeChoice,
  PERSPECTIVE_VIEWER_THEME_ATTR,
  readStoredPerspectiveTheme,
  REGISTERED_PERSPECTIVE_THEME_NAMES,
  sanitizeLayoutName,
  saveLayoutToStorage,
  type VortexBlotterRowEditorDraft,
  type VortexBlotterRowStyleConditionOp,
  type VortexBlotterRowStyleRule,
  type VortexBlotterSavedLayoutV1,
  type VortexPerspectiveThemeChoice,
} from '@vortex/blotter-core';

import './vortex-blotter.css';

type PerspectiveViewerEl = HTMLElement & {
  load: (table: unknown) => Promise<void>;
  save?: () => Promise<unknown>;
  restore?: (config: unknown) => Promise<unknown>;
  resize?: (force?: boolean | null) => Promise<unknown>;
  resetThemes?: (names: readonly string[]) => Promise<unknown>;
};

export interface VortexBlotterProps {
  tableName?: string;
  websocketUrl?: string;
  tablesListApiUrl?: string;
  rowStyleRules?: VortexBlotterRowStyleRule[];
  columnHeaderLabels?: Record<string, string>;
}

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
  'Demo data is shown. Type or pick a WebSocket URL and table name below, then connect\u2014or pass tableName and websocketUrl from the parent.';

const WS_URL_OPTIONS = [
  'http://localhost:8080/websocket',
  'ws://localhost:8080/ws',
  'ws://127.0.0.1:8080/websocket',
] as const;

const TABLE_NAME_OPTIONS = ['fx_executions', 'demo', 'main'] as const;

const CONDITION_OP_OPTIONS: {
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

const EDITOR_FONT_SIZE_OPTIONS: VortexBlotterRowEditorDraft['fontSize'][] = [
  '',
  'smaller',
  'small',
  'regular',
  'large',
  'extraLarge',
  'xtraLarge',
  'xtraLarger',
];

const EDITOR_FONT_WEIGHT_OPTIONS: VortexBlotterRowEditorDraft['fontWeight'][] = [
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

let idSeq = 0;
let editorRowSeq = 0;
let columnHeaderRowSeq = 0;

function newEditorRow(): VortexBlotterRowEditorDraft & { id: string } {
  return {
    id: `vb-er-${editorRowSeq++}`,
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

function newColumnHeaderRow(): {
  id: string;
  columnKey: string;
  displayName: string;
} {
  return {
    id: `vb-ch-${columnHeaderRowSeq++}`,
    columnKey: '',
    displayName: '',
  };
}

function columnHeaderRowsToRecord(
  rows: { columnKey: string; displayName: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.columnKey.trim();
    const d = r.displayName.trim();
    if (k && d) {
      out[k] = d;
    }
  }
  return out;
}

function toWebSocketUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith('https://')) {
    return 'wss://' + t.slice('https://'.length);
  }
  if (t.startsWith('http://')) {
    return 'ws://' + t.slice('http://'.length);
  }
  return t;
}

export function VortexBlotter({
  tableName = '',
  websocketUrl = '',
  tablesListApiUrl = '',
  rowStyleRules = [],
  columnHeaderLabels = {},
}: VortexBlotterProps): ReactElement {
  // --- Stable IDs ---
  const fieldUidRef = useRef(`vb-${idSeq++}`);
  const fieldUid = fieldUidRef.current;

  const wsInputId = `vortex-blotter-ws-${fieldUid}`;
  const wsPresetSelectId = `vortex-blotter-ws-presets-${fieldUid}`;
  const tablesApiInputId = `vortex-blotter-tables-api-${fieldUid}`;
  const tableInputId = `vortex-blotter-table-${fieldUid}`;
  const tablePresetSelectId = `vortex-blotter-table-presets-${fieldUid}`;
  const rowStyleEditorTitleId = `vortex-blotter-row-style-title-${fieldUid}`;
  const rowStyleEditorPanelId = `vortex-blotter-row-style-panel-${fieldUid}`;
  const columnHeaderEditorTitleId = `vortex-blotter-col-headers-title-${fieldUid}`;
  const columnHeaderEditorPanelId = `vortex-blotter-col-headers-panel-${fieldUid}`;
  const tableColumnDatalistId = `vortex-blotter-cols-${fieldUid}`;
  const layoutManagerTitleId = `vortex-blotter-layouts-title-${fieldUid}`;
  const layoutManagerPanelId = `vortex-blotter-layouts-panel-${fieldUid}`;
  const layoutManagerNameInputId = `vortex-blotter-layout-name-${fieldUid}`;
  const toolbarDetailsPanelId = `vortex-blotter-toolbar-details-${fieldUid}`;
  const themeSelectId = `vortex-blotter-theme-${fieldUid}`;

  // --- Refs ---
  const viewerRef = useRef<HTMLElement>(null);
  const loadSeqRef = useRef(0);
  const columnsLoadSeqRef = useRef(0);
  const rowStyleCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const columnHeaderCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const perspectiveThemesRegisteredRef = useRef(false);

  // --- State ---
  const [rowStyleEditorOpen, setRowStyleEditorOpen] = useState(false);
  const [editorRows, setEditorRows] = useState<
    (VortexBlotterRowEditorDraft & { id: string })[]
  >([]);
  const [appliedEditorRules, setAppliedEditorRules] = useState<
    VortexBlotterRowStyleRule[]
  >([]);
  const [appliedColumnHeaderLabels, setAppliedColumnHeaderLabels] = useState<
    Record<string, string>
  >({});
  const [loadedTable, setLoadedTable] = useState<Table | null>(null);
  const [tableColumnNames, setTableColumnNames] = useState<string[]>([]);
  const [columnHeaderEditorOpen, setColumnHeaderEditorOpen] = useState(false);
  const [columnHeaderRows, setColumnHeaderRows] = useState<
    { id: string; columnKey: string; displayName: string }[]
  >([]);
  const [layoutManagerOpen, setLayoutManagerOpen] = useState(false);
  const [layoutSaveName, setLayoutSaveName] = useState('');
  const [layoutStatusMessage, setLayoutStatusMessage] = useState<string | null>(
    null,
  );
  const [savedLayoutNames, setSavedLayoutNames] = useState<string[]>([]);
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const [perspectiveThemeChoice, setPerspectiveThemeChoice] =
    useState<VortexPerspectiveThemeChoice>(() => readStoredPerspectiveTheme());
  const [internalUrl, setInternalUrl] = useState('http://localhost:4000/ws');
  const [internalTable, setInternalTable] = useState('RatesMarketData');
  const [internalTablesListApiUrl, setInternalTablesListApiUrl] = useState(
    'http://localhost:8090/api/tables',
  );
  const [fetchedTableNames, setFetchedTableNames] = useState<string[]>([]);
  const [tablesListFetchError, setTablesListFetchError] = useState<
    string | null
  >(null);
  const [tablesListLoading, setTablesListLoading] = useState(false);
  const [internalLive, setInternalLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tablesListRefetchNonce, setTablesListRefetchNonce] = useState(0);

  // --- Computed / Memo ---
  const mergedRowStyleRules = useMemo(
    () => [...rowStyleRules, ...appliedEditorRules],
    [rowStyleRules, appliedEditorRules],
  );

  const mergedColumnHeaderLabelsValue = useMemo(
    () => ({ ...columnHeaderLabels, ...appliedColumnHeaderLabels }),
    [columnHeaderLabels, appliedColumnHeaderLabels],
  );

  const hasParentConfig = useMemo(() => {
    const n = tableName.trim();
    const u = websocketUrl.trim();
    return n.length > 0 && u.length > 0;
  }, [tableName, websocketUrl]);

  const statusBadge = useMemo(() => {
    if (loading) return 'Connecting';
    if (hasParentConfig || internalLive) return 'Live';
    if (demoHint) return 'Demo';
    return 'Live';
  }, [loading, hasParentConfig, internalLive, demoHint]);

  const toolbarToggleAriaLabel = useMemo(
    () => (toolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'),
    [toolbarExpanded],
  );

  const perspectiveViewerThemeAttr = useMemo(
    () => PERSPECTIVE_VIEWER_THEME_ATTR[perspectiveThemeChoice],
    [perspectiveThemeChoice],
  );

  const columnFieldPlaceholder = useMemo(
    () =>
      tableColumnNames.length > 0
        ? 'Choose from list or type'
        : 'Load a table for suggestions',
    [tableColumnNames],
  );

  const internalUrlPresetSelectValue = useMemo(() => {
    return (WS_URL_OPTIONS as readonly string[]).includes(internalUrl)
      ? internalUrl
      : '';
  }, [internalUrl]);

  const tableNameSelectOptions = useMemo(() => {
    const staticNames = TABLE_NAME_OPTIONS as readonly string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of staticNames) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    for (const s of fetchedTableNames) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    return out;
  }, [fetchedTableNames]);

  const internalTablePresetSelectValue = useMemo(
    () => (tableNameSelectOptions.includes(internalTable) ? internalTable : ''),
    [tableNameSelectOptions, internalTable],
  );

  const effectiveTablesListApiUrl = useMemo(() => {
    const fromParent = tablesListApiUrl.trim();
    if (fromParent.length > 0) return fromParent;
    return internalTablesListApiUrl.trim();
  }, [tablesListApiUrl, internalTablesListApiUrl]);

  const isTablesListApiUrlFromParent = useMemo(
    () => tablesListApiUrl.trim().length > 0,
    [tablesListApiUrl],
  );

  const tablesListApiUrlFieldValue = useMemo(
    () =>
      isTablesListApiUrlFromParent ? tablesListApiUrl : internalTablesListApiUrl,
    [isTablesListApiUrlFromParent, tablesListApiUrl, internalTablesListApiUrl],
  );

  // --- Helpers (stable refs for async) ---
  const disposeRowStyles = useCallback(async () => {
    if (rowStyleCleanupRef.current) {
      await rowStyleCleanupRef.current();
      rowStyleCleanupRef.current = null;
    }
  }, []);

  const disposeColumnHeaderLabels = useCallback(async () => {
    if (columnHeaderCleanupRef.current) {
      await columnHeaderCleanupRef.current();
      columnHeaderCleanupRef.current = null;
    }
  }, []);

  // --- Inject Perspective theme CSS on mount ---
  useEffect(() => {
    injectVortexCustomPerspectiveThemesCss();
  }, []);

  // --- Register Perspective theme list ---
  useEffect(() => {
    const host = viewerRef.current;
    if (!host || perspectiveThemesRegisteredRef.current) return;

    let cancelled = false;
    const register = async () => {
      if (typeof customElements === 'undefined') return;
      await customElements.whenDefined('perspective-viewer');
      if (cancelled) return;
      injectVortexCustomPerspectiveThemesCss();
      const viewer = host as PerspectiveViewerEl;
      for (let i = 0; i < 24; i++) {
        if (typeof viewer.resetThemes === 'function') break;
        await new Promise((r) => setTimeout(r, 25));
        if (cancelled) return;
      }
      if (typeof viewer.resetThemes !== 'function') return;
      try {
        await viewer.resetThemes([...REGISTERED_PERSPECTIVE_THEME_NAMES]);
        perspectiveThemesRegisteredRef.current = true;
      } catch {
        /* ignore */
      }
    };
    void register();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Main load effect (table binding) ---
  useEffect(() => {
    const host = viewerRef.current;
    if (!host) return;

    let cancelled = false;
    const seq = ++loadSeqRef.current;

    const run = async () => {
      // Wait for the custom element to upgrade so .load is available
      if (typeof customElements !== 'undefined') {
        await customElements.whenDefined('perspective-viewer');
      }
      if (cancelled) return;

      const viewer = host as PerspectiveViewerEl;
      // Poll briefly for .load in case the upgrade is async
      for (let i = 0; i < 50 && typeof viewer.load !== 'function'; i++) {
        await new Promise((r) => setTimeout(r, 25));
        if (cancelled) return;
      }
      if (typeof viewer.load !== 'function') return;

      const parentName = tableName.trim();
      const parentUrl = websocketUrl.trim();
      const hasBothParent = parentName.length > 0 && parentUrl.length > 0;
      const partialParent = parentName.length > 0 !== parentUrl.length > 0;

      if (partialParent) {
        setLoadedTable(null);
        setLoadError(
          'Provide both tableName and websocketUrl for a live server, or omit both for demo data.',
        );
        setDemoHint(null);
        return;
      }

      setLoading(true);
      setLoadError(null);
      setDemoHint(null);
      setLoadedTable(null);

      try {
        if (hasBothParent) {
          const client = await perspective.websocket(toWebSocketUrl(parentUrl));
          if (cancelled || seq !== loadSeqRef.current) return;
          const table = await client.open_table(parentName);
          if (cancelled || seq !== loadSeqRef.current) return;
          await viewer.load(table);
          if (cancelled || seq !== loadSeqRef.current) return;
          setLoadedTable(table);
        } else if (!internalLive) {
          const worker = await perspective.worker();
          if (cancelled || seq !== loadSeqRef.current) return;
          const table = await worker.table(DEMO_ROWS);
          if (cancelled || seq !== loadSeqRef.current) return;
          await viewer.load(table);
          if (cancelled || seq !== loadSeqRef.current) return;
          setLoadedTable(table);
          setDemoHint(DEMO_HINT);
        } else {
          const client = await perspective.websocket(toWebSocketUrl(internalUrl));
          if (cancelled || seq !== loadSeqRef.current) return;
          const tbl = await client.open_table(internalTable.trim());
          if (cancelled || seq !== loadSeqRef.current) return;
          await viewer.load(tbl);
          if (cancelled || seq !== loadSeqRef.current) return;
          setLoadedTable(tbl);
        }
      } catch (err) {
        if (cancelled || seq !== loadSeqRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
        setLoadedTable(null);
      } finally {
        if (!cancelled && seq === loadSeqRef.current) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [tableName, websocketUrl, internalLive, internalUrl, internalTable]);

  // --- Fetch tables list effect ---
  useEffect(() => {
    if (hasParentConfig) {
      setFetchedTableNames([]);
      setTablesListFetchError(null);
      setTablesListLoading(false);
      return;
    }

    const url = effectiveTablesListApiUrl;
    if (url.length === 0) {
      setFetchedTableNames([]);
      setTablesListFetchError(null);
      setTablesListLoading(false);
      return;
    }

    const ac = new AbortController();
    const doFetch = async () => {
      setTablesListLoading(true);
      setTablesListFetchError(null);
      try {
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Tables list HTTP ${res.status}`);
        const json: unknown = await res.json();
        if (ac.signal.aborted) return;
        const names = parseTablesListResponse(json);
        setFetchedTableNames(names);
        setTablesListFetchError(null);
      } catch (e) {
        if (
          ac.signal.aborted ||
          (e instanceof DOMException && e.name === 'AbortError')
        )
          return;
        setFetchedTableNames([]);
        setTablesListFetchError(
          e instanceof Error ? e.message : 'Failed to load tables',
        );
      } finally {
        if (!ac.signal.aborted) {
          setTablesListLoading(false);
        }
      }
    };
    void doFetch();
    return () => ac.abort();
  }, [hasParentConfig, effectiveTablesListApiUrl, tablesListRefetchNonce]);

  // --- Sync row styles effect ---
  useEffect(() => {
    const viewer = viewerRef.current;
    const tbl = loadedTable;
    if (!viewer || !tbl) {
      void disposeRowStyles();
      return;
    }
    const sync = async () => {
      await disposeRowStyles();
      if (mergedRowStyleRules.length === 0) return;
      rowStyleCleanupRef.current = attachVortexBlotterRowStyles(
        viewer,
        tbl,
        mergedRowStyleRules,
      );
    };
    void sync();
  }, [mergedRowStyleRules, loadedTable, disposeRowStyles]);

  // --- Refresh table column names effect ---
  useEffect(() => {
    const seq = ++columnsLoadSeqRef.current;
    if (!loadedTable) {
      if (seq === columnsLoadSeqRef.current) setTableColumnNames([]);
      return;
    }
    const refresh = async () => {
      try {
        const cols = await loadedTable.columns();
        if (seq !== columnsLoadSeqRef.current) return;
        const names = Array.isArray(cols) ? cols.map((c) => String(c)) : [];
        setTableColumnNames(names);
      } catch {
        if (seq === columnsLoadSeqRef.current) setTableColumnNames([]);
      }
    };
    void refresh();
  }, [loadedTable]);

  // --- Sync column header labels effect ---
  useEffect(() => {
    const viewer = viewerRef.current;
    const tbl = loadedTable;
    if (!viewer || !tbl) {
      void disposeColumnHeaderLabels();
      return;
    }
    const sync = async () => {
      await disposeColumnHeaderLabels();
      if (Object.keys(mergedColumnHeaderLabelsValue).length === 0) return;
      columnHeaderCleanupRef.current =
        attachVortexBlotterColumnHeaderLabels(
          viewer,
          tbl,
          mergedColumnHeaderLabelsValue,
        );
    };
    void sync();
  }, [mergedColumnHeaderLabelsValue, loadedTable, disposeColumnHeaderLabels]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      void disposeRowStyles();
      void disposeColumnHeaderLabels();
    };
  }, [disposeRowStyles, disposeColumnHeaderLabels]);

  // --- Escape key handler ---
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (layoutManagerOpen) {
        event.preventDefault();
        setLayoutManagerOpen(false);
        return;
      }
      if (columnHeaderEditorOpen) {
        event.preventDefault();
        setColumnHeaderEditorOpen(false);
        return;
      }
      if (rowStyleEditorOpen) {
        event.preventDefault();
        setRowStyleEditorOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [layoutManagerOpen, columnHeaderEditorOpen, rowStyleEditorOpen]);

  // --- Event handlers ---
  const toggleToolbar = useCallback(
    () => setToolbarExpanded((v) => !v),
    [],
  );

  const onPerspectiveThemeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const v = event.target.value as VortexPerspectiveThemeChoice;
      if (v !== 'pro-dark' && v !== 'carbon' && v !== 'neo-quantum') return;
      setPerspectiveThemeChoice(v);
      persistPerspectiveThemeChoice(v);
    },
    [],
  );

  const onWsInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) =>
      setInternalUrl((event.target as HTMLInputElement).value),
    [],
  );

  const onTableInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) =>
      setInternalTable((event.target as HTMLInputElement).value),
    [],
  );

  const onWsPresetChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const v = event.target.value;
      if (v.length > 0) setInternalUrl(v);
    },
    [],
  );

  const onTablePresetChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const v = event.target.value;
      if (v.length > 0) setInternalTable(v);
    },
    [],
  );

  const onTablesListApiUrlInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      if (isTablesListApiUrlFromParent) return;
      setInternalTablesListApiUrl((event.target as HTMLInputElement).value);
    },
    [isTablesListApiUrlFromParent],
  );

  const refreshTablesList = useCallback(
    () => setTablesListRefetchNonce((n) => n + 1),
    [],
  );

  const connectFromPicker = useCallback(() => setInternalLive(true), []);

  const onLayoutSaveNameInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) =>
      setLayoutSaveName((event.target as HTMLInputElement).value),
    [],
  );

  const refreshSavedLayoutNames = useCallback(
    () => setSavedLayoutNames(listLayoutNames()),
    [],
  );

  // --- Editor row handlers ---
  const patchEditorRow = useCallback(
    (id: string, patch: Partial<VortexBlotterRowEditorDraft>) => {
      setEditorRows((rows) =>
        rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const addEditorRow = useCallback(
    () => setEditorRows((rows) => [...rows, newEditorRow()]),
    [],
  );

  const removeEditorRow = useCallback(
    (id: string) =>
      setEditorRows((rows) => rows.filter((r) => r.id !== id)),
    [],
  );

  const onEditorColumnInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) =>
      patchEditorRow(id, {
        column: (event.target as HTMLInputElement).value,
      }),
    [patchEditorRow],
  );

  const onEditorValueInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) =>
      patchEditorRow(id, {
        value: (event.target as HTMLInputElement).value,
      }),
    [patchEditorRow],
  );

  const onEditorOrderInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) => {
      const raw = (event.target as HTMLInputElement).value;
      const n = Number(raw);
      patchEditorRow(id, {
        order: raw === '' || Number.isNaN(n) ? 0 : n,
      });
    },
    [patchEditorRow],
  );

  const onEditorBgInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) =>
      patchEditorRow(id, {
        backgroundColor: (event.target as HTMLInputElement).value,
      }),
    [patchEditorRow],
  );

  const onEditorFgInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) =>
      patchEditorRow(id, {
        color: (event.target as HTMLInputElement).value,
      }),
    [patchEditorRow],
  );

  const onEditorOpChange = useCallback(
    (id: string, event: React.ChangeEvent<HTMLSelectElement>) =>
      patchEditorRow(id, {
        op: event.target.value as VortexBlotterRowStyleConditionOp,
      }),
    [patchEditorRow],
  );

  const onEditorFontSizeChange = useCallback(
    (id: string, event: React.ChangeEvent<HTMLSelectElement>) =>
      patchEditorRow(id, {
        fontSize: event.target
          .value as VortexBlotterRowEditorDraft['fontSize'],
      }),
    [patchEditorRow],
  );

  const onEditorFontWeightChange = useCallback(
    (id: string, event: React.ChangeEvent<HTMLSelectElement>) =>
      patchEditorRow(id, {
        fontWeight: event.target
          .value as VortexBlotterRowEditorDraft['fontWeight'],
      }),
    [patchEditorRow],
  );

  const applyRowStyleEditor = useCallback(
    () => setAppliedEditorRules(draftsToStyleRules(editorRows)),
    [editorRows],
  );

  const clearAppliedEditorRules = useCallback(
    () => setAppliedEditorRules([]),
    [],
  );

  // --- Column header row handlers ---
  const patchColumnHeaderRow = useCallback(
    (
      id: string,
      patch: Partial<{ columnKey: string; displayName: string }>,
    ) => {
      setColumnHeaderRows((rows) =>
        rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const addColumnHeaderRow = useCallback(
    () => setColumnHeaderRows((rows) => [...rows, newColumnHeaderRow()]),
    [],
  );

  const removeColumnHeaderRow = useCallback(
    (id: string) =>
      setColumnHeaderRows((rows) => rows.filter((r) => r.id !== id)),
    [],
  );

  const onColumnHeaderKeyInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) =>
      patchColumnHeaderRow(id, {
        columnKey: (event.target as HTMLInputElement).value,
      }),
    [patchColumnHeaderRow],
  );

  const onColumnHeaderDisplayInput = useCallback(
    (id: string, event: React.FormEvent<HTMLInputElement>) =>
      patchColumnHeaderRow(id, {
        displayName: (event.target as HTMLInputElement).value,
      }),
    [patchColumnHeaderRow],
  );

  const applyColumnHeaderEditor = useCallback(
    () =>
      setAppliedColumnHeaderLabels(columnHeaderRowsToRecord(columnHeaderRows)),
    [columnHeaderRows],
  );

  const clearAppliedColumnHeaderLabels = useCallback(
    () => setAppliedColumnHeaderLabels({}),
    [],
  );

  const seedColumnHeaderRowsFromTable = useCallback(() => {
    if (tableColumnNames.length === 0) return;
    setColumnHeaderRows(
      tableColumnNames.map((c) => ({
        id: `vb-ch-${columnHeaderRowSeq++}`,
        columnKey: c,
        displayName: c,
      })),
    );
  }, [tableColumnNames]);

  // --- Dialog openers/closers ---
  const openRowStyleEditor = useCallback(() => {
    setLayoutManagerOpen(false);
    setColumnHeaderEditorOpen(false);
    setEditorRows((rows) => (rows.length === 0 ? [newEditorRow()] : rows));
    setRowStyleEditorOpen(true);
  }, []);

  const closeRowStyleEditor = useCallback(
    () => setRowStyleEditorOpen(false),
    [],
  );

  const openColumnHeaderEditor = useCallback(() => {
    setLayoutManagerOpen(false);
    setRowStyleEditorOpen(false);
    setColumnHeaderRows((rows) =>
      rows.length === 0 ? [newColumnHeaderRow()] : rows,
    );
    setColumnHeaderEditorOpen(true);
  }, []);

  const closeColumnHeaderEditor = useCallback(
    () => setColumnHeaderEditorOpen(false),
    [],
  );

  const openLayoutManager = useCallback(() => {
    setRowStyleEditorOpen(false);
    setColumnHeaderEditorOpen(false);
    setLayoutStatusMessage(null);
    setSavedLayoutNames(listLayoutNames());
    setLayoutManagerOpen(true);
  }, []);

  const closeLayoutManager = useCallback(
    () => setLayoutManagerOpen(false),
    [],
  );

  // --- Layout save/load/delete ---
  const collectLayoutSnapshot =
    useCallback(async (): Promise<VortexBlotterSavedLayoutV1> => {
      const viewer = viewerRef.current as PerspectiveViewerEl | undefined;
      let perspectiveState: unknown = null;
      if (viewer && typeof viewer.save === 'function') {
        try {
          const raw = await viewer.save();
          perspectiveState = clonePerspectiveTokenForJson(raw);
        } catch {
          perspectiveState = null;
        }
      }
      const rowStyleEditorRowsCleaned = editorRows.map(
        ({ id: _id, ...rest }) => rest,
      );
      const columnHeaderRowsCleaned = columnHeaderRows.map(
        ({ id: _id, ...rest }) => rest,
      );
      return {
        version: 1,
        perspective: perspectiveState,
        rowStyleEditorRows: rowStyleEditorRowsCleaned,
        columnHeaderRows: columnHeaderRowsCleaned,
        perspectiveTheme: perspectiveThemeChoice,
      };
    }, [editorRows, columnHeaderRows, perspectiveThemeChoice]);

  const applyLayoutSnapshot = useCallback(
    async (layout: VortexBlotterSavedLayoutV1): Promise<boolean> => {
      const viewer = viewerRef.current as PerspectiveViewerEl | undefined;
      let perspectiveFailed = false;
      if (viewer && layout.perspective != null) {
        perspectiveFailed = await applyPerspectiveLayoutToken(
          viewer,
          layout.perspective,
          loadedTable,
        );
      }

      const savedTheme = parseVortexPerspectiveThemeChoice(
        layout.perspectiveTheme,
      );
      if (savedTheme !== undefined) {
        setPerspectiveThemeChoice(savedTheme);
        persistPerspectiveThemeChoice(savedTheme);
      }

      setEditorRows(
        layout.rowStyleEditorRows.map((d) => ({
          ...d,
          id: `vb-er-${editorRowSeq++}`,
        })),
      );
      setColumnHeaderRows(
        layout.columnHeaderRows.map((r) => ({
          ...r,
          id: `vb-ch-${columnHeaderRowSeq++}`,
        })),
      );

      // Apply both editors inline
      setAppliedEditorRules(draftsToStyleRules(
        layout.rowStyleEditorRows.map((d) => ({
          ...d,
          id: `temp-${editorRowSeq}`,
        })),
      ));
      setAppliedColumnHeaderLabels(
        columnHeaderRowsToRecord(layout.columnHeaderRows),
      );

      return perspectiveFailed;
    },
    [loadedTable],
  );

  const saveCurrentLayoutToStorage = useCallback(async () => {
    setLayoutStatusMessage(null);
    const name = sanitizeLayoutName(layoutSaveName);
    if (!name) {
      setLayoutStatusMessage('Enter a name for this layout.');
      return;
    }
    try {
      const snapshot = await collectLayoutSnapshot();
      saveLayoutToStorage(name, snapshot);
      setSavedLayoutNames(listLayoutNames());
      setLayoutStatusMessage(`Saved layout "${name}".`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLayoutStatusMessage(msg);
    }
  }, [layoutSaveName, collectLayoutSnapshot]);

  const loadLayoutByName = useCallback(
    async (name: string) => {
      setLayoutStatusMessage(null);
      const layout = loadLayoutFromStorage(name);
      if (!layout) {
        setLayoutStatusMessage(`Layout "${name}" was not found.`);
        setSavedLayoutNames(listLayoutNames());
        return;
      }
      try {
        const perspectiveFailed = await applyLayoutSnapshot(layout);
        setLayoutStatusMessage(
          perspectiveFailed
            ? `Loaded "${name}" (row styles & headers; saved Perspective view could not be restored).`
            : `Loaded layout "${name}".`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setLayoutStatusMessage(msg);
      }
    },
    [applyLayoutSnapshot],
  );

  const deleteLayoutByName = useCallback((name: string) => {
    setLayoutStatusMessage(null);
    deleteLayoutFromStorage(name);
    setSavedLayoutNames(listLayoutNames());
    setLayoutStatusMessage(`Removed layout "${name}".`);
  }, []);

  // --- JSX ---
  return (
    <section
      className="blotter"
      aria-label="Vortex blotter"
      aria-busy={loading}
      data-perspective-theme={perspectiveThemeChoice}
    >
      <div className="blotter-body">
        {loadError && (
          <p className="blotter-error" role="alert">
            {loadError}
          </p>
        )}
        <header
          className={`blotter-toolbar${!toolbarExpanded ? ' blotter-toolbar--collapsed' : ''}`}
        >
          <button
            type="button"
            className="blotter-toolbar__bar"
            onClick={toggleToolbar}
            aria-expanded={toolbarExpanded}
            aria-controls={toolbarDetailsPanelId}
            aria-label={toolbarToggleAriaLabel}
            title="Show or hide toolbar"
          >
            <svg
              className="blotter-toolbar__chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
              />
            </svg>
          </button>
          <div
            className="blotter-toolbar__details"
            id={toolbarDetailsPanelId}
            aria-hidden={!toolbarExpanded}
            inert={!toolbarExpanded || undefined}
          >
            <div className="blotter-toolbar__details-inner">
              <div className="blotter-toolbar__tools">
                <span className="blotter-badge">{statusBadge}</span>
                <div className="blotter-theme-field">
                  <label
                    className="blotter-theme-label"
                    htmlFor={themeSelectId}
                  >
                    Theme
                  </label>
                  <select
                    id={themeSelectId}
                    className="blotter-theme-select"
                    value={perspectiveThemeChoice}
                    onChange={onPerspectiveThemeChange}
                    title="Grid theme"
                  >
                    <option value="pro-dark">Pro Dark</option>
                    <option value="carbon">Carbon</option>
                    <option value="neo-quantum">Neo Quantum</option>
                  </select>
                </div>
                <div className="blotter-head-actions">
                  <button
                    type="button"
                    className="blotter-icon-btn"
                    onClick={openRowStyleEditor}
                    aria-expanded={rowStyleEditorOpen}
                    aria-controls={rowStyleEditorPanelId}
                    aria-haspopup="dialog"
                    aria-label="Row style rules"
                    title="Row style rules"
                  >
                    <svg
                      className="blotter-icon-btn__svg"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        fill="currentColor"
                        d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.5.5 0 0 0-.5-.43h-3.8a.5.5 0 0 0-.5.43l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.74 8.87c-.14.23-.1.52.12.64l2.03 1.58c-.05.31-.08.63-.08.94s.02.63.08.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.37.31.6.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.27.43.5.43h3.8c.25 0 .46-.19.5-.43l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.23.09.48 0 .6-.22l1.92-3.32c.12-.22.1-.51-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="blotter-icon-btn"
                    onClick={openColumnHeaderEditor}
                    aria-expanded={columnHeaderEditorOpen}
                    aria-controls={columnHeaderEditorPanelId}
                    aria-haspopup="dialog"
                    aria-label="Column header names"
                    title="Column header names"
                  >
                    <svg
                      className="blotter-icon-btn__svg"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        fill="currentColor"
                        d="M3 5v14h18V5H3zm16 2v1H5V7h14zm0 4v4H5v-4h14zm0 6v1H5v-1h14z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="blotter-icon-btn"
                    onClick={openLayoutManager}
                    aria-expanded={layoutManagerOpen}
                    aria-controls={layoutManagerPanelId}
                    aria-haspopup="dialog"
                    aria-label="Save or load layouts"
                    title="Layouts (save / load)"
                  >
                    <svg
                      className="blotter-icon-btn__svg"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        fill="currentColor"
                        d="M17 3H5c-1.11 0-2 .9-2 2v14h4v-4h10V5c0-1.1-.9-2-2-2zm-5 12h-2v-2h2v2zm0-4h-2V5h2v6z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {!hasParentConfig && demoHint && (
                <p className="blotter-info" role="status">
                  {demoHint}
                </p>
              )}
              {!hasParentConfig && (
                <div className="blotter-setup">
                  <div className="blotter-field blotter-field--url">
                    <label className="blotter-label" htmlFor={wsInputId}>
                      WebSocket URL
                    </label>
                    <input
                      id={wsInputId}
                      type="text"
                      className="blotter-input"
                      value={internalUrl}
                      onInput={onWsInput}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="ws://host:port/path"
                    />
                    <select
                      id={wsPresetSelectId}
                      className="blotter-theme-select blotter-preset-select"
                      value={internalUrlPresetSelectValue}
                      onChange={onWsPresetChange}
                      aria-label="Suggested WebSocket URLs"
                      title="Choose a preset or edit the URL above"
                    >
                      <option value="">Choose a preset…</option>
                      {WS_URL_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="blotter-field blotter-field--tables-api"
                    aria-busy={tablesListLoading}
                  >
                    <label
                      className="blotter-label"
                      htmlFor={tablesApiInputId}
                    >
                      Tables list (REST)
                    </label>
                    <div className="blotter-setup-api-row">
                      <input
                        id={tablesApiInputId}
                        type="url"
                        className="blotter-input blotter-setup-api-input"
                        value={tablesListApiUrlFieldValue}
                        readOnly={isTablesListApiUrlFromParent}
                        onInput={onTablesListApiUrlInput}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="http://localhost:8090/api/tables"
                        title="JSON endpoint that returns hosted table names"
                      />
                      <button
                        type="button"
                        className="blotter-icon-btn blotter-setup-api-refresh"
                        onClick={refreshTablesList}
                        disabled={
                          effectiveTablesListApiUrl.trim().length === 0 ||
                          tablesListLoading
                        }
                        aria-label="Refresh table list from API"
                        title="Refresh table list"
                      >
                        <svg
                          className="blotter-icon-btn__svg"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            fill="currentColor"
                            d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.56 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                          />
                        </svg>
                      </button>
                    </div>
                    {tablesListFetchError && (
                      <p
                        className="blotter-setup-api-msg blotter-setup-api-msg--error"
                        role="status"
                      >
                        {tablesListFetchError}
                      </p>
                    )}
                  </div>
                  <div className="blotter-field">
                    <label className="blotter-label" htmlFor={tableInputId}>
                      Table name
                    </label>
                    <input
                      id={tableInputId}
                      type="text"
                      className="blotter-input"
                      value={internalTable}
                      onInput={onTableInput}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="Hosted table id"
                    />
                    <select
                      id={tablePresetSelectId}
                      className="blotter-theme-select blotter-preset-select"
                      value={internalTablePresetSelectValue}
                      onChange={onTablePresetChange}
                      aria-label="Suggested table names"
                      title="Choose a preset or edit the name above"
                    >
                      <option value="">Choose a preset…</option>
                      {tableNameSelectOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!internalLive && (
                    <button
                      type="button"
                      className="blotter-connect"
                      onClick={connectFromPicker}
                    >
                      Connect to server
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="blotter-viewer-wrap">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <perspective-viewer
            {...{ ref: viewerRef } as any}
            className="perspective-host"
            theme={perspectiveViewerThemeAttr}
          />
        </div>
      </div>

      {/* Row Style Editor Dialog */}
      {rowStyleEditorOpen && (
        <>
          <div
            className="row-style-editor-backdrop"
            role="presentation"
            onClick={closeRowStyleEditor}
          />
          <div
            className="row-style-editor-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={rowStyleEditorTitleId}
            id={rowStyleEditorPanelId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-style-editor-head">
              <h2
                className="row-style-editor-title"
                id={rowStyleEditorTitleId}
              >
                Row style editor
              </h2>
              <p className="row-style-editor-sub">
                Rules here merge with <code>rowStyleRules</code> from the host.
                Higher <strong>order</strong> wins when several rules match the
                same row. Column names are inferred from the loaded table when
                possible; use the field suggestions or type a column name.
              </p>
            </div>

            <div className="row-style-editor-table-wrap">
              <table className="row-style-editor-table">
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Condition</th>
                    <th scope="col">Value</th>
                    <th scope="col">Order</th>
                    <th scope="col">Background</th>
                    <th scope="col">Text</th>
                    <th scope="col">Size</th>
                    <th scope="col">Weight</th>
                    <th scope="col">
                      <span className="row-style-editor-sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editorRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="text"
                          className="blotter-input row-style-editor-input"
                          list={
                            tableColumnNames.length > 0
                              ? tableColumnDatalistId
                              : undefined
                          }
                          value={row.column}
                          onInput={(e) => onEditorColumnInput(row.id, e)}
                          placeholder={columnFieldPlaceholder}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </td>
                      <td>
                        <select
                          className="blotter-input row-style-editor-select"
                          value={row.op}
                          onChange={(e) => onEditorOpChange(row.id, e)}
                        >
                          {CONDITION_OP_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="blotter-input row-style-editor-input"
                          value={row.value}
                          onInput={(e) => onEditorValueInput(row.id, e)}
                          placeholder="Compare value"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="blotter-input row-style-editor-input row-style-editor-input--narrow"
                          value={row.order}
                          onInput={(e) => onEditorOrderInput(row.id, e)}
                          step={1}
                          title="Precedence when multiple rules match"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="blotter-input row-style-editor-input"
                          value={row.backgroundColor}
                          onInput={(e) => onEditorBgInput(row.id, e)}
                          placeholder="#rrggbb"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="blotter-input row-style-editor-input"
                          value={row.color}
                          onInput={(e) => onEditorFgInput(row.id, e)}
                          placeholder="#rrggbb"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </td>
                      <td>
                        <select
                          className="blotter-input row-style-editor-select"
                          value={row.fontSize}
                          onChange={(e) => onEditorFontSizeChange(row.id, e)}
                        >
                          {EDITOR_FONT_SIZE_OPTIONS.map((sz) => (
                            <option key={sz} value={sz}>
                              {sz === '' ? '\u2014' : sz}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="blotter-input row-style-editor-select"
                          value={row.fontWeight}
                          onChange={(e) => onEditorFontWeightChange(row.id, e)}
                        >
                          {EDITOR_FONT_WEIGHT_OPTIONS.map((w) => (
                            <option key={w} value={w}>
                              {w === '' ? '\u2014' : w}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="row-style-editor-actions">
                        <button
                          type="button"
                          className="row-style-editor-remove"
                          onClick={() => removeEditorRow(row.id)}
                          title="Remove rule"
                        >
                          {'\u00d7'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row-style-editor-toolbar">
              <button
                type="button"
                className="blotter-connect"
                onClick={addEditorRow}
              >
                Add rule
              </button>
            </div>

            <div className="row-style-editor-footer">
              <button
                type="button"
                className="blotter-connect"
                onClick={applyRowStyleEditor}
              >
                Apply row styles
              </button>
              <button
                type="button"
                className="row-style-editor-btn-secondary"
                onClick={clearAppliedEditorRules}
              >
                Clear applied (editor)
              </button>
              <button
                type="button"
                className="row-style-editor-btn-secondary"
                onClick={closeRowStyleEditor}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Column Header Editor Dialog */}
      {columnHeaderEditorOpen && (
        <>
          <div
            className="row-style-editor-backdrop"
            role="presentation"
            onClick={closeColumnHeaderEditor}
          />
          <div
            className="row-style-editor-panel row-style-editor-panel--column-headers"
            role="dialog"
            aria-modal="true"
            aria-labelledby={columnHeaderEditorTitleId}
            id={columnHeaderEditorPanelId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-style-editor-head">
              <h2
                className="row-style-editor-title"
                id={columnHeaderEditorTitleId}
              >
                Column header names
              </h2>
              <p className="row-style-editor-sub">
                Map each <strong>schema</strong> column name (from the table) to
                the text shown in the grid header. Row style rules and filters
                still use schema names.
              </p>
            </div>

            <div className="row-style-editor-table-wrap">
              <table className="row-style-editor-table">
                <thead>
                  <tr>
                    <th scope="col">Schema column</th>
                    <th scope="col">Header display</th>
                    <th scope="col">
                      <span className="row-style-editor-sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {columnHeaderRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="text"
                          className="blotter-input row-style-editor-input"
                          list={
                            tableColumnNames.length > 0
                              ? tableColumnDatalistId
                              : undefined
                          }
                          value={row.columnKey}
                          onInput={(e) => onColumnHeaderKeyInput(row.id, e)}
                          placeholder="e.g. Quantity"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="blotter-input row-style-editor-input"
                          value={row.displayName}
                          onInput={(e) =>
                            onColumnHeaderDisplayInput(row.id, e)
                          }
                          placeholder="e.g. Qty"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </td>
                      <td className="row-style-editor-actions">
                        <button
                          type="button"
                          className="row-style-editor-remove"
                          onClick={() => removeColumnHeaderRow(row.id)}
                          title="Remove row"
                        >
                          {'\u00d7'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row-style-editor-toolbar">
              <button
                type="button"
                className="blotter-connect"
                onClick={addColumnHeaderRow}
              >
                Add row
              </button>
              <button
                type="button"
                className="row-style-editor-btn-secondary"
                onClick={seedColumnHeaderRowsFromTable}
                disabled={tableColumnNames.length === 0}
                title="Fill one row per loaded column"
              >
                Fill from table
              </button>
            </div>

            <div className="row-style-editor-footer">
              <button
                type="button"
                className="blotter-connect"
                onClick={applyColumnHeaderEditor}
              >
                Apply header names
              </button>
              <button
                type="button"
                className="row-style-editor-btn-secondary"
                onClick={clearAppliedColumnHeaderLabels}
              >
                Clear applied (editor)
              </button>
              <button
                type="button"
                className="row-style-editor-btn-secondary"
                onClick={closeColumnHeaderEditor}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Layout Manager Dialog */}
      {layoutManagerOpen && (
        <>
          <div
            className="row-style-editor-backdrop"
            role="presentation"
            onClick={closeLayoutManager}
          />
          <div
            className="row-style-editor-panel row-style-editor-panel--layouts"
            role="dialog"
            aria-modal="true"
            aria-labelledby={layoutManagerTitleId}
            id={layoutManagerPanelId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-style-editor-head">
              <h2
                className="row-style-editor-title"
                id={layoutManagerTitleId}
              >
                Layouts
              </h2>
              <p className="row-style-editor-sub">
                Save the current <strong>Perspective</strong> view (sort,
                filter, columns, pivots, etc.), <strong>row style</strong>{' '}
                editor rules, and <strong>column header</strong> names to this
                browser's <code>localStorage</code>. Host{' '}
                <code>rowStyleRules</code> are not included.
              </p>
            </div>

            <div className="layout-manager-save">
              <label
                className="blotter-label"
                htmlFor={layoutManagerNameInputId}
              >
                New layout name
              </label>
              <div className="layout-manager-save-row">
                <input
                  id={layoutManagerNameInputId}
                  type="text"
                  className="blotter-input"
                  value={layoutSaveName}
                  onInput={onLayoutSaveNameInput}
                  placeholder="e.g. My desk view"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={128}
                />
                <button
                  type="button"
                  className="blotter-connect"
                  onClick={saveCurrentLayoutToStorage}
                >
                  Save
                </button>
              </div>
            </div>

            {layoutStatusMessage && (
              <p className="layout-manager-status" role="status">
                {layoutStatusMessage}
              </p>
            )}

            <div className="layout-manager-saved-head">Saved layouts</div>
            <ul className="layout-manager-list">
              {savedLayoutNames.length > 0 ? (
                savedLayoutNames.map((name) => (
                  <li key={name} className="layout-manager-item">
                    <span className="layout-manager-item-name">{name}</span>
                    <div className="layout-manager-item-actions">
                      <button
                        type="button"
                        className="blotter-connect layout-manager-item-btn"
                        onClick={() => loadLayoutByName(name)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="row-style-editor-btn-secondary layout-manager-item-btn"
                        onClick={() => deleteLayoutByName(name)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="layout-manager-empty">
                  No layouts saved yet.
                </li>
              )}
            </ul>

            <div className="row-style-editor-footer">
              <button
                type="button"
                className="row-style-editor-btn-secondary"
                onClick={closeLayoutManager}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Column name datalist */}
      {tableColumnNames.length > 0 && (
        <datalist id={tableColumnDatalistId}>
          {tableColumnNames.map((col) => (
            <option key={col} value={col} />
          ))}
        </datalist>
      )}
    </section>
  );
}

export default VortexBlotter;
