import { spawn } from 'child_process';
import { createEtcdClient } from './helper/etcd';

export default async () => {
  const proc = spawn('sh', ['scripts/startEtcd.sh'], {
    stdio: 'pipe',
    detached: true,
    cwd: __dirname,
  });

  await new Promise(resolve => {
    // only error message can tell the server is ready or not
    proc.stderr.on('data', (buffer: Buffer) => {
      const message = buffer.toString();
      console.log(message);
      if (message.includes('ready to serve client requests')) {
        resolve();
      }
    });
  });

  const client = createEtcdClient();

  await client.delete().all();
};
