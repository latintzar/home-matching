import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import dgram from 'node:dgram';
import {syncBuiltinESMExports} from 'node:module';

/** Proof-only guard. The application keeps its original provider adapters. */
export function installNetworkFence() {
  const attempts = [];
  const original = [];
  const deny = () => {
    attempts.push('blocked network operation');
    throw new Error('The synthetic first result uses local source and fixture files.');
  };
  for (const [owner, name] of [
    [globalThis, 'fetch'], [http, 'request'], [http, 'get'],
    [https, 'request'], [https, 'get'], [net, 'connect'],
    [net, 'createConnection'], [net.Socket.prototype, 'connect'],
    [tls, 'connect'], [dns, 'lookup'], [dns, 'resolve'],
    [dgram, 'createSocket'],
  ]) {
    original.push([owner, name, owner[name]]);
    owner[name] = deny;
  }
  syncBuiltinESMExports();
  return {
    attempts,
    restore() {
      for (const [owner, name, value] of original) owner[name] = value;
      syncBuiltinESMExports();
    },
  };
}
