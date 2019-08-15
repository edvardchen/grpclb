import path from 'path';
import { GrpcObject, Client, credentials } from 'grpc';
import isServiceClient from '../utils/isServiceClient';
import { EtcdResolver, KVParser } from './resolver';
import Debug from 'debug';
import { IOptions } from 'etcd3';

const debug = Debug('grpclb:client');

const grpcOption = {
  'grpc.max_receive_message_length': 1024 * 1024 * 100,
  'grpc.max_send_message_length': 1024 * 1024 * 100,
};

// 是否需要 service client pool，先实现吧
// one address only can host a service
const serviceClientPool: { [address: string]: Client } = {};

// all proxy share the same resovler
let resolver: EtcdResolver;

export default async function createGrpcProxy(options: {
  etcdHosts?: IOptions['hosts'];
  parseKV: KVParser;
  target: GrpcObject;
}): Promise<GrpcObject> {
  const { etcdHosts, target, parseKV } = options;

  if (!resolver) {
    const { ETCD_NAMESPACE, ETCD_HOSTS } = process.env;

    debug(`ETCD_NAMESPACE is ${ETCD_NAMESPACE}`);

    resolver = new EtcdResolver(
      etcdHosts || ETCD_HOSTS || '',
      parseKV,
      ETCD_NAMESPACE
    );

    await resolver.watch();
  }

  return new Proxy(target, {
    get(target, key: string) {
      const original = target[key];
      // detect the original value is ServiceClient or not
      if (!isServiceClient(original)) {
        return original;
      }

      // type asertion
      const ServiceClient = original as typeof Client;

      // randomly choose one method. All methods' paths are the same
      // @ts-ignore
      const [{ path: fullPath }] = Object.values(ServiceClient.service);

      // pack.age.Service name
      const serviceName = path.basename(path.dirname(fullPath));

      // select a servant node
      const servant = resolver.next(serviceName);
      if (!servant) {
        throw new Error(`no available node for ${serviceName}`);
      }

      let client: Client | undefined = serviceClientPool[servant];
      if (!client) {
        // the initialization
        client = serviceClientPool[serviceName] = new ServiceClient(
          servant,
          credentials.createInsecure(),
          grpcOption
        ) as Client;
      }

      return client;
    },
  });
}
