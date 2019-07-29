import { GrpcObject } from 'grpc';

export default function isServiceClient(obj: GrpcObject[string]): boolean {
  return typeof obj === 'function';
  // more strict
  // && obj.name ==='ServiceClient'
}
