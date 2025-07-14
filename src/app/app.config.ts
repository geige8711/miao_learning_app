import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { provideHotToastConfig } from '@ngneat/hot-toast';
import { createApollo } from './graphql.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideApollo(createApollo),
    provideHotToastConfig({
      position: 'bottom-right',
      duration: 5000,
    }),
  ],
};
