import { spawnSync } from 'child_process';

export default () => {
  spawnSync('sh', ['scripts/stopEtcd.sh'], {
    stdio: 'pipe',
    cwd: __dirname,
  });
};
