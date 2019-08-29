import Debug from 'debug';
import path from 'path';
import { Client as GrpcClient, ChannelCredentials, credentials } from 'grpc';
import { EtcdResolver, KVParser } from './resolver';
import { IOptions } from 'etcd3';

const debug = Debug('grpclb:resolver');

const grpcOption = {
  'grpc.max_receive_message_length': 1024 * 1024 * 100,
  'grpc.max_send_message_length': 1024 * 1024 * 100,
};

export interface CreateClient<T> {
  new (address: string, credentials: ChannelCredentials, options?: object): T;
}

// all proxy share the same resovler
let resolver: EtcdResolver | undefined;

export async function destroyGlobalPool(): Promise<void> {
  return resolver && resolver.destroy();
}

export function globalResolver(): EtcdResolver | undefined {
  return resolver;
}

export async function initGlobalResolver({
  etcdHosts,
  parseKV,
}: InitOptions): Promise<void> {
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
}

// 是否需要 service client pool，先实现吧
// one address only can host a service
const serviceClientPool: { [address: string]: GrpcClient } = {};

/** get client instance from global pool */
export function getClientInstance<T extends GrpcClient>(
  Client: CreateClient<T>
): T {
  // randomly choose one method. All methods' paths are the same
  // @ts-ignore
  const [{ path: fullPath }] = Object.values(Client.service);

  // pack.age.Service name
  const serviceName = path.basename(path.dirname(fullPath));

  if (!resolver) {
    throw new Error(
      'etcd resolver not inited. You should call initGlobalResolver() first'
    );
  }

  // select a servant node
  const servant = resolver.next(serviceName);
  if (!servant) {
    throw new Error(`no available node for ${serviceName}`);
  }

  let client = serviceClientPool[servant] as T;
  if (!client) {
    // the initialization
    client = serviceClientPool[serviceName] = new Client(
      servant,
      credentials.createInsecure(),
      grpcOption
    );
  }

  return client;
}

export type InitOptions = {
  etcdHosts?: IOptions['hosts'];
  parseKV: KVParser;
};
