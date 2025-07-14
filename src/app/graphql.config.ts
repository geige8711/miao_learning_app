import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloClientOptions,
  NormalizedCacheObject,
} from '@apollo/client/core';
import { environment } from '../environments/environment';

const httpLink = new HttpLink({
  uri: environment.hygraphUrl,
  headers: {
    Authorization: `Bearer ${environment.hygraphToken}`,
  },
});

export function createApollo(): ApolloClientOptions<NormalizedCacheObject> {
  return {
    link: httpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
      mutate: {
        context: {
          useMultipart: true,
        },
      },
    },
  };
}
