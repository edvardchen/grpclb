import { Etcd3, Lease } from 'etcd3';
import Debug from 'debug';
import { Server } from 'grpc';

const debug = Debug('grpclb:server');

type Str = string | (() => string);

type RegisterOptions = {
  server?: Server;

  /** etcd lease ttl in seconds */
  ttl?: number;

  /** etcd key and value */
  etcdKV: { key: Str; value?: Str };

  /** etcd hosts, or set on env var ETCD_HOSTS */
  etcdHosts?: string | string[];
};

export default async function register({
  server,
  ttl = 10, // 10 seconds,
  etcdKV: { key: _key, value: _value = '' },
  etcdHosts = process.env.ETCD_HOSTS,
}: RegisterOptions): Promise<() => Promise<void>> {
  if (!etcdHosts || !etcdHosts.length) {
    throw new Error('etcdHosts empty');
  }

  const hosts =
    typeof etcdHosts === 'string'
      ? etcdHosts.split(',').map(item => item.trim())
      : etcdHosts;

  const client = new Etcd3({ hosts });

  const key = typeof _key === 'string' ? _key : _key();
  const value = typeof _value === 'string' ? _value : _value();

  let lease: Lease;
  async function grantLease(): Promise<void> {
    lease = client.lease(ttl); // set a TTL of 10 seconds

    lease.on('lost', err => {
      debug('We lost our lease as a result of this error:', err);
      debug('Trying to re-grant it...');
      !lease.revoked() && grantLease();
    });

    await lease.put(key).value(value);
  }

  await grantLease();

  async function revoke(): Promise<void> {
    await lease.revoke();
  }

  if (server) {
    const old = server.tryShutdown;
    server.tryShutdown = callback => {
      revoke().finally(() => {
        old.call(server, callback);
      });
    };

    const original = server.forceShutdown;
    server.forceShutdown = () => {
      return revoke().finally(() => {
        original.call(server);
      });
    };
  }

  return revoke;
}
