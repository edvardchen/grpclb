import { Client as GrpcClient } from 'grpc';
import {
  CreateClient,
  InitOptions,
  initGlobalResolver,
  getClientInstance,
} from './globalClientPool';

export interface Pool<T extends GrpcClient> {
  get(): T;
}

export default async function createClientPool<T extends GrpcClient>(
  optiions: {
    Client: CreateClient<T>;
  } & InitOptions
): Promise<Pool<T>> {
  const { Client, ...rest } = optiions;

  await initGlobalResolver(rest);

  return {
    get(): T {
      return getClientInstance(Client);
    },
  };
}
