import _ from 'lodash';
import Debug from 'debug';
import { Etcd3, Watcher, IOptions } from 'etcd3';
import removeFromArray from '../utils/removeFromArray';

const debug = Debug('grpclb:resolver');

type ServantNode = {
  service: string;
  address: string;
};

type Store = {
  [service: string]: {
    items: ServantNode[];
    currIndex: number;
  };
};

export interface KVParser {
  (key: string, value?: string): ServantNode | undefined;
}

export class EtcdResolver {
  client: Etcd3;

  constructor(
    hosts: IOptions['hosts'],
    protected parse: KVParser,
    protected prefix?: string
  ) {
    if (!hosts || !hosts.length) {
      throw new Error(`not etcd hosts found`);
    }

    hosts = typeof hosts === 'string' ? hosts.split(',') : hosts;
    //、初始化 client
    this.client = new Etcd3({ hosts });
  }

  store: Store = {};

  watcher?: Watcher;

  /** watch etcd key */
  async watch(): Promise<void> {
    // 获取所有该命名空间下的节点
    this.store = await this.getNodes();

    // watching needs prefix
    this.watcher = await this.client
      .watch()
      .prefix(this.prefix || '')
      .create();

    this.watcher
      .on('put', ({ key, value }) => {
        debug(`put key: ${key}, value: ${value} `);
        this.onAdd(key.toString(), value.toString());
      })
      .on('delete', ({ key }) => {
        debug(`delete key ${key} `);
        this.onDel(key.toString());
      })
      .on('connecting', () => {
        debug('ectc connecting');
      })
      .on(
        'connected',
        async ({ header: { cluster_id, member_id, revision } }) => {
          debug(
            `etcd connected to cluster ${cluster_id}, member_id ${member_id}, revision ${revision}`
          );
        }
      )
      .on('error', error => {
        debug(error);
      })
      .on('disconnected', error => {
        debug(`etcd disconnected due to ${error.message}`, error);
      });
  }

  onAdd(key: string, value: string): void {
    const node = this.parseEtcdKV(key, value);
    if (!node) return;

    const { service, address } = node;

    this.store[service] = this.store[service] || { items: [], currIndex: 0 };

    const { items } = this.store[service];

    // deduplicate
    if (!items.find(item => item.address === address)) {
      items.push({
        address,
        service,
      });
    }
  }

  onDel(key: string): void {
    const node = this.parseEtcdKV(key);
    if (!node) return;

    const { address, service } = node;

    this.store[service] &&
      removeFromArray(
        this.store[service].items,
        item => item.address === address
      );
  }

  parseEtcdKV(originalKey: string, value?: string): ServantNode | undefined {
    let key = originalKey;
    if (this.prefix) {
      key = originalKey.replace(this.prefix, '');
    }
    return this.parse(key, value);
  }

  async getNodes(): Promise<Store> {
    const query = this.client.getAll().prefix(this.prefix || '');

    const nodes = await query;

    const nodeSet = _.transform<string, Store>(
      nodes,
      (result, value, _key) => {
        const node = this.parseEtcdKV(_key, value);
        if (!node) return;
        const { service, address } = node;
        result[service] = result[service] || { items: [], currIndex: 0 };
        result[service].items.push({ service, address });
      },
      {}
    );

    return nodeSet;
  }

  /** next servant node */
  next(service: string): string | undefined {
    const nodeSet = this.store[service];
    if (!nodeSet) return;

    const { items, currIndex } = nodeSet;

    // currIndex maybe overflow
    const result = items[currIndex % items.length].address;

    // 递增
    nodeSet.currIndex++;

    return result;
  }

  async destroy(): Promise<void> {
    return this.watcher && this.watcher.cancel();
  }
}
