import { loadSync } from '@grpc/proto-loader';
import { loadPackageDefinition, GrpcObject, Server } from 'grpc';

// @ts-ignore
import startGreeterServer from './fixtures/helloworld/greeter_server';
import { register, createGrpcProxy } from '../src';
import { hosts, parseKV } from './helper/etcd';
import sleep from './helper/sleep';
import { destroyGlobalPool } from '../src/client/globalClientPool';
// import log from 'why-is-node-running';

describe('client dynamic - grpc proxy', () => {
  let pkgDef: GrpcObject;

  beforeAll(() => {
    const PROTO_PATH = __dirname + '/fixtures/helloworld/helloworld.proto';

    const packageDefinition = loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    pkgDef = loadPackageDefinition(packageDefinition);
    process.env.ETCD_NAMESPACE = 'test-services:';
  });

  afterAll(async () => {
    delete process.env.ETCD_NAMESPACE;
    await destroyGlobalPool();
  });

  let revokers: Server[];
  beforeAll(async () => {
    revokers = await Promise.all(
      [50051, 50052].map(async port => {
        // const port = Math.floor(Math.random() * 1e4);
        // start server
        const server = startGreeterServer(port) as Server;

        await register({
          server,
          etcdKV: {
            key: `test-services:helloworld.Greeter:localhost:${port}`,
          },
          etcdHosts: hosts,
        });

        return server;
      })
    );
  });

  afterAll(async () => {
    return Promise.all(
      revokers.map(item => {
        return new Promise(resolve => {
          item.tryShutdown(resolve);
        });
      })
    );
  });

  let proxy: GrpcObject;
  beforeAll(async () => {
    proxy = await createGrpcProxy({
      etcdHosts: hosts,
      target: pkgDef.helloworld,
      parseKV,
    });
  });
  it('round=robin', async () => {
    const first = proxy.Greeter.getChannel().getTarget();

    const second = proxy.Greeter.getChannel().getTarget();

    expect(second).not.toEqual(first);
    // expect(address).toEqual(':50051');
    const third = proxy.Greeter.getChannel().getTarget();
    expect(third).toEqual(first);

    // revoke
    const revoker = revokers.shift();
    revoker && (await revoker.forceShutdown());
    await sleep(200);
    const fourth = proxy.Greeter.getChannel().getTarget();
    const fifth = proxy.Greeter.getChannel().getTarget();

    expect(fourth).toEqual(fifth);
    expect(fourth).not.toBeUndefined();
  });

  it('sayHello', async () => {
    const result = (await new Promise((resolve, reject) => {
      proxy.Greeter.sayHello(
        { name: 'edvard' },
        (err: Error | null, response: { message: string }) => {
          if (err) return reject(err);
          resolve(response);
        }
      );
    })) as { message: string };
    expect(result.message).toEqual('Hello edvard');
  });
});
