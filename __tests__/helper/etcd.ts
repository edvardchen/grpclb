import { Etcd3 } from 'etcd3';

export const hosts = 'http://localhost:2379';

export const createEtcdClient = (): Etcd3 => {
  return new Etcd3({ hosts });
};

export function parseKV(key: string): { service: string; address: string } {
  const [service, host, port] = key.split(':');
  return {
    service,
    address: `${host}:${port}`,
  };
}
