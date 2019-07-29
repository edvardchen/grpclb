# grpclb

grpc load balancer integrated with [etcd] for Node.js

## Install

```bash
npm i grpclb
```

## Usage

### Server side

```typescript
import { register } from 'grpclb';

const revoke = await register({
  server, // your grpc server instance
  etcdKV: { key, value }, // leave you to decide how to serialize service name, host, port into KV
  ttl: 10, // default 10 in seconds
  etcdHosts: hosts, // etcd hosts, or you can set as env var ETCD_HOSTS
});

// then you can revoke
// by direct call the revoke handler
revoke();

// or by shutting down the grpc server
server.tryShutdown(() => {});
```

### Client side

- client-side load balancing with `round-robin strategy`

We can't register custom service resolver util [the `c` library exposes the api](https://github.com/grpc/grpc-node/issues/719).

So we can implement client-side load-balancing on the other way: [javascript Proxy](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

```typescript
import { createGrpcProxy } from 'grpclb';

proxy = await createGrpcProxy({
  etcdHosts: hosts, // etcd hosts, or you can set as env var ETCD_HOSTS
  target: pkgDef.helloworld, // your gRPC object, MUST be the package definition object
  parseKV, // how to extract service name, host, port from etcd key and value
});

// Every time you access the service object, you get the new servant address.
proxy.Greeter;

// The service was already initialized and
// you can just call the service method to send request
proxy.Greeter.sayHello({ name }, (error, response) => {});
```

[etcd]: https://github.com/etcd-io/etcd
