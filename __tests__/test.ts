import { register } from '../src';
import { Etcd3 } from 'etcd3';
import { createEtcdClient, hosts } from './helper/etcd';
import sleep from './helper/sleep';

describe('grpclb', () => {
  let client: Etcd3;
  beforeAll(() => {
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

    await sleep(1000);

    // keep alive
    const result2 = await client.get(key);
    expect(result2).not.toBeNull();

    // revoke
    unregister();

    await sleep(1000);

    const result3 = await client.get(key);
    expect(result3).toBeNull();
  });
});
