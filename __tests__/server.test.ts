import debug from 'debug';
import { Etcd3 } from 'etcd3';

import { register } from '../src';
import { createEtcdClient, hosts, parseKV } from './helper/etcd';
import sleep from './helper/sleep';
import { EtcdResolver } from '../src/client/resolver';
import { Server } from 'grpc';

describe('grpclb', () => {
  let client: Etcd3;
  beforeAll(() => {
    debug.enable('grpclb:*');
    client = createEtcdClient();
  });

  it('register', async () => {
    const key = 'hello_work:127.0.0.1:30004';

    const unregister = await register({
      etcdKV: { key },
      ttl: 1,
      etcdHosts: hosts,
    });

    const result = await client.get(key);
    expect(result).not.toBeNull();

    await sleep(3000);

    // keep alive
    const result2 = await client.get(key);
    expect(result2).not.toBeNull();

    // revoke
    await unregister();

    const result3 = await client.get(key);
    expect(result3).toBeNull();
  });

  it('unregister by server,tryShutdown', async () => {
    const key = 'hello_work:127.0.0.1:30004';

    const server = new Server();
    await register({
      server,
      etcdKV: { key },
      ttl: 1,
      etcdHosts: hosts,
    });
    await new Promise(resolve => {
      server.tryShutdown(resolve);
    });
  });

  describe('lb', () => {
    let resolver: EtcdResolver;

    beforeEach(async () => {
      resolver = new EtcdResolver(hosts, parseKV, 'test-services:');
    });

    afterEach(async () => {
      await resolver.destroy();
    });

    it('resolver', async () => {
      await resolver.watch();

      await client
        .put('test-services:a.b.HelloService:127.0.0.1:1234')
        .value('1');

      await sleep(200);
      const address = resolver.next('a.b.HelloService');
      expect(address).toEqual('127.0.0.1:1234');
    });

    it('round-robin', async () => {
      await resolver.watch();

      const ports = Array.from({ length: 3 }).map(() =>
        Math.floor(Math.random() * 10000)
      );

      await Promise.all(
        ports.map(item =>
          client
            .put(`test-services:a.c.HelloService:127.0.0.1:${item}`)
            .value('1')
        )
      );
      await sleep(200);
      const first = resolver.next('a.c.HelloService');

      let temp;
      for (let i = 0; i < 2; i++) {
        temp = resolver.next('a.c.HelloService');
        expect(temp).not.toEqual(first);
      }
      temp = resolver.next('a.c.HelloService');

      expect(first).toEqual(temp);
    });
  });
});
