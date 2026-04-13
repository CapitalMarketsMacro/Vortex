import { VortexBlotter, useVortexBlotter } from '@vortex/blotter-react';
import type { VortexBlotterRowStyleRule } from '@vortex/blotter-core';
import { parseVortexBlotterNumericValue } from '@vortex/blotter-core';
import './App.css';

const rowStyles: VortexBlotterRowStyleRule[] = [
  {
    column: 'Side',
    match: (v) => v === 'BUY',
    backgroundColor: 'rgba(20, 100, 60, 0.35)',
    color: '#bbf7d0',
    order: 1,
  },
  {
    column: 'Side',
    match: (v) => v === 'SELL',
    backgroundColor: 'rgba(120, 30, 30, 0.35)',
    color: '#fca5a5',
    order: 1,
  },
  {
    column: 'Price',
    match: (v) => {
      const n = parseVortexBlotterNumericValue(v);
      return n !== null && n >= 500;
    },
    fontWeight: 'bold',
    order: 2,
  },
  {
    column: 'Quantity',
    match: (v) => {
      const n = parseVortexBlotterNumericValue(v);
      return n !== null && n >= 100;
    },
    fontSize: 'large',
    order: 2,
  },
];

export function App() {
  const { isReady } = useVortexBlotter();

  if (!isReady) {
    return (
      <div className="app-loading">
        <p>Loading Perspective WASM...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Vortex React</h1>
      </header>
      <main className="app-main">
        <VortexBlotter rowStyleRules={rowStyles} />
      </main>
    </div>
  );
}
