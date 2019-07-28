import { Etcd3 } from 'etcd3';

export const hosts = 'http://localhost:2379';

export const createEtcdClient = (): Etcd3 => {
  return new Etcd3({ hosts });
};
