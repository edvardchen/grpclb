import { Etcd3, Lease } from 'etcd3';
import Debug from 'debug';

const debug = Debug('grpclb');

type Str = string | (() => string);

type RegisterOptions = {
  /** etcd lease ttl in seconds */
  ttl?: number;

  /** etcd key and value */
  etcdKV: { key: Str; value?: Str };

  /** etcd hosts, or set on env var ETCD_HOSTS */
  etcdHosts?: string | string[];
};

export async function register({
  ttl = 10, // 10 seconds,
  etcdKV: { key, value = '' },
  etcdHosts = process.env.ETCD_HOSTS,
}: RegisterOptions): Promise<() => void> {
  if (!etcdHosts || !etcdHosts.length) {
    throw new Error('etcdHosts empty');
  }

  const hosts =
    typeof etcdHosts === 'string' ? etcdHosts.split(',') : etcdHosts;

  const client = new Etcd3({ hosts });

  let lease: Lease;
  async function grantLease(): Promise<void> {
    lease = client.lease(ttl); // set a TTL of 10 seconds

    lease.on('lost', err => {
      debug('We lost our lease as a result of this error:', err);
      debug('Trying to re-grant it...');
      !lease.revoked() && grantLease();
    });

    await lease
      .put(typeof key === 'string' ? key : key())
      .value(typeof value === 'string' ? value : value());
  }

  await grantLease();

  return () => {
    lease.revoke();
  };
}
