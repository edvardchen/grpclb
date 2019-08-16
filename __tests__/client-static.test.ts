// @ts-ignore
import startGreeterServer from './fixtures/helloworld/greeter_server';
// @ts-ignore
import { GreeterClient } from './fixtures/helloworld/static_codegen/helloworld_grpc_pb';
import createClientPool from '../src/client/createClientPool';
import { hosts, parseKV } from './helper/etcd';
import {
  HelloRequest,
  HelloReply,
} from './fixtures/helloworld/static_codegen/helloworld_pb';
import { Server } from 'grpc';
import { register } from '../src';
import sleep from './helper/sleep';
import { destroyGlobalPool } from '../src/client/globalClientPool';

describe('client static - grpc client pool', () => {
  describe('round:robin', () => {
    beforeAll(() => {
      process.env.ETCD_NAMESPACE = 'test-services:';
    });
    afterAll(() => {
      delete process.env.ETCD_NAMESPACE;
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
      revokers.map(item => item.forceShutdown());
      await destroyGlobalPool();
    });

    it('round=robin', async () => {
      const pool = await createClientPool({
        Client: GreeterClient,
        parseKV,
        etcdHosts: hosts,
      });
      const first = pool
        .get()
        .getChannel()
        .getTarget();

      const second = pool
        .get()
        .getChannel()
        .getTarget();

      expect(second).not.toEqual(first);
      const third = pool
        .get()
        .getChannel()
        .getTarget();
      expect(third).toEqual(first);

      // revoke
      const revoker = revokers.shift();
      revoker && revoker.forceShutdown();
      await sleep(200);
      const fourth = pool
        .get()
        .getChannel()
        .getTarget();
      const fifth = pool
        .get()
        .getChannel()
        .getTarget();

      expect(fourth).toEqual(fifth);
      expect(fourth).not.toBeUndefined();
    });

    it('sayHello', async () => {
      const pool = await createClientPool({
        Client: GreeterClient,
        parseKV,
        etcdHosts: hosts,
      });
      const result = (await new Promise((resolve, reject) => {
        const req = new HelloRequest();
        req.setName('edvard');
        pool
          .get()
          // @ts-ignore
          .sayHello(req, (err: Error | null, response: HelloReply) => {
            if (err) return reject(err);
            resolve(response);
          });
      })) as HelloReply;
      expect(result.getMessage()).toEqual('Hello edvard');
    });
  });
});
