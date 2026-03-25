import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { bootstrapPerspective } from './perspective-bootstrap';

bootstrapPerspective()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
