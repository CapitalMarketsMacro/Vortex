import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideVortexBlotter } from 'vortex-blotter';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideVortexBlotter(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
