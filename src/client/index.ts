import { GrpcObject } from 'grpc';
import isServiceClient from '../utils/isServiceClient';
import { KVParser } from './resolver';
import { IOptions } from 'etcd3';
import { initGlobalResolver, getClientInstance } from './globalClientPool';

export default async function createGrpcProxy(options: {
  etcdHosts?: IOptions['hosts'];
  parseKV: KVParser;
  target: GrpcObject;
}): Promise<GrpcObject> {
  const { etcdHosts, target, parseKV } = options;

  await initGlobalResolver({ etcdHosts, parseKV });

  return new Proxy(target, {
    get(target, key: string) {
      const original = target[key];
      // detect the original value is ServiceClient or not
      if (!isServiceClient(original)) {
        return original;
      }

      return getClientInstance(original);
    },
  });
}
