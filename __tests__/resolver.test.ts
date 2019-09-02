/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { EtcdResolver } from '../src/client/resolver';

describe('resolver', () => {
  it('parse KV', () => {
    const resovler = new EtcdResolver(
      ['localhost:1234'],
      (key, value) => {
        return {
          service: key,
          address: value || key,
        };
      },
      'uat-services:'
    );

    expect(
      resovler.parseEtcdKV(
        'uat-services:apc.account.AccountService:1.1.1.1:31202',
        '1'
      )!.service
    ).toEqual('apc.account.AccountService:1.1.1.1:31202');
  });
});
