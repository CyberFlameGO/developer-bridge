import * as t from 'io-ts';
import stream from 'stream';
import websocketStream from 'websocket-stream';

import { apiFetch, assertAPIResponseOK, decodeJSON } from './baseAPI';
import { assertContentType } from '../util/fetchUtil';
import environment from '../auth/environment';

// tslint:disable-next-line:variable-name
export const Host = t.type(
  {
    id: t.string,
    displayName: t.string,
    roles: t.array(t.string),
    state: t.union([t.literal('available'), t.literal('busy')]),
  },
  'Host',
);
export type Host = t.TypeOf<typeof Host>;

export type Hosts = { appHost: Host[]; companionHost: Host[] };

// tslint:disable-next-line:variable-name
const HostsResponse = t.type(
  {
    hosts: t.array(Host),
  },
  'HostsResponse',
);

export class DeveloperRelay {
  constructor(
    private apiUrl: string = environment().config.apiUrl,
    private shouldAuth: boolean = true,
  ) {}

  async connect(hostID: string): Promise<stream.Duplex> {
    const url = await this.getConnectionURL(
      hostID,
      this.apiUrl,
      this.shouldAuth,
    );

    return this.createWebSocket(url);
  }

  async hosts(): Promise<Hosts> {
    const response = await apiFetch(
      '1/user/-/developer-relay/hosts.json',
      undefined,
      this.apiUrl,
      this.shouldAuth,
    ).then(decodeJSON(HostsResponse));

    const hostsWithRole = (role: string) =>
      response.hosts.filter((host) => host.roles.includes(role));

    return {
      appHost: hostsWithRole('APP_HOST'),
      companionHost: hostsWithRole('COMPANION_HOST'),
    };
  }

  private async getConnectionURL(
    hostID: string,
    apiUrl?: string,
    shouldAuth?: boolean,
  ): Promise<string> {
    const response = await apiFetch(
      `1/user/-/developer-relay/hosts/${hostID}`,
      {
        method: 'POST',
      },
      apiUrl,
      shouldAuth,
    )
      .then(assertAPIResponseOK)
      .then(assertContentType('text/uri-list'));

    const uriList = (await response.text())
      .split('\r\n')
      .filter((line) => line[0] !== '#');

    return uriList[0];
  }

  private createWebSocket(uri: string): Promise<stream.Duplex> {
    return new Promise<stream.Duplex>((resolve, reject) => {
      const ws = websocketStream(uri, { objectMode: true });
      ws.on('connect', () => resolve(ws));
      ws.on('error', (e) => reject(e));
    });
  }
}
