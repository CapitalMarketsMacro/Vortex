import {
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import {
  bootstrapVortexBlotterPerspective,
  VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE,
} from './perspective-bootstrap';

export interface ProvideVortexBlotterOptions {
  /**
   * Base URL where `perspective-server.wasm` and `perspective-viewer.wasm` are served.
   * Default matches {@link VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE}.
   */
  wasmAssetsBaseUrl?: string;
}

/** Override WASM asset base when not using the default `/assets/vortex-blotter/wasm/`. */
export const VORTEX_BLOTTER_WASM_ASSETS_BASE = new InjectionToken<string>(
  'VORTEX_BLOTTER_WASM_ASSETS_BASE',
  {
    factory: () => VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE,
  },
);

/**
 * One-line Angular integration: runs Perspective WASM init before the app boots.
 * Add to ApplicationConfig.providers (e.g. provideVortexBlotter() near the top).
 *
 * WASM: copy the library wasm folder via angular.json assets (match VORTEX_BLOTTER_DEFAULT_WASM_ASSETS_BASE).
 * Optional wasmAssetsBaseUrl, or provide VORTEX_BLOTTER_WASM_ASSETS_BASE for DI overrides.
 *
 * Styles: add perspective-themes.css from the library to build.options.styles.
 * Peers: @perspective-dev packages and Angular per vortex-blotter package.json.
 */
export function provideVortexBlotter(options?: ProvideVortexBlotterOptions) {
  return makeEnvironmentProviders([
    ...(options?.wasmAssetsBaseUrl != null
      ? [{ provide: VORTEX_BLOTTER_WASM_ASSETS_BASE, useValue: options.wasmAssetsBaseUrl }]
      : []),
    provideAppInitializer(async () => {
      const base = inject(VORTEX_BLOTTER_WASM_ASSETS_BASE);
      await bootstrapVortexBlotterPerspective(base);
    }),
  ]);
}
