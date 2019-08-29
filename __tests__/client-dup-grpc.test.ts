/* eslint-disable no-regex-spaces */
/* eslint-disable @typescript-eslint/no-var-requires */
import { exec } from 'child_process';
import fs from 'fs';

describe('duplicate grpc', () => {
  const fakeProject = __dirname + '/fixtures/fakeProject';
  beforeAll(done => {
    exec(`mkdir ${fakeProject}`, error => {
      if (error) return done(error);
      fs.writeFile(fakeProject + '/package.json', '{}', error => {
        if (error) return done(error);
        exec('npm i grpc', { env: process.env, cwd: fakeProject }, done);
      });
    });
  }, 60000);

  afterAll(done => {
    exec(`rm -rf ${fakeProject}`, error => {
      done(error);
    });
  });

  it('method call should throw error', () => {
    const { credentials } = require('grpc');
    jest.doMock('grpc', () => {
      return require(`${fakeProject}/node_modules/grpc`);
    });
    const {
      GreeterClient,
    } = require('./fixtures/helloworld/static_codegen/helloworld_grpc_pb');
    expect(() => {
      new GreeterClient('localhost:1234', credentials.createInsecure());
    }).toThrow(/Channel's second argument.* must be a ChannelCredentials/);
    jest.unmock('grpc');
  });
});
