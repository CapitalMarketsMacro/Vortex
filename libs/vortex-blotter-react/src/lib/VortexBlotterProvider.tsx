import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  bootstrapVortexBlotterPerspective,
  VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE,
} from '@vortex/blotter-core';

interface VortexBlotterContextValue {
  isReady: boolean;
}

const VortexBlotterContext = createContext<VortexBlotterContextValue>({
  isReady: false,
});

export function useVortexBlotter(): VortexBlotterContextValue {
  return useContext(VortexBlotterContext);
}

export function VortexBlotterProvider({
  wasmAssetsBaseUrl = VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE,
  children,
}: {
  wasmAssetsBaseUrl?: string;
  children: ReactNode;
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bootstrapVortexBlotterPerspective(wasmAssetsBaseUrl)
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((err) => {
        console.error('[VortexBlotterProvider] WASM init failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [wasmAssetsBaseUrl]);

  return (
    <VortexBlotterContext.Provider value={{ isReady }}>
      {children}
    </VortexBlotterContext.Provider>
  );
}
