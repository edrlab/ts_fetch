import {IAuthenticationToken} from './http.type';
import {URL} from 'url';

const debug = console.log;

export type TAuthenticationStorage = Record<string, IAuthenticationToken>;

export class AuthenticationStorage {
  private _data: TAuthenticationStorage;

  constructor(__data: TAuthenticationStorage = {}) {
    this._data = __data;
  }

  public setAuthenticationToken(data: IAuthenticationToken) {
    if (!data.authenticationUrl) {
      throw new Error('no opdsAutenticationUrl !!');
    }

    const url = new URL(data.authenticationUrl);
    const {host} = url;
    // do not risk showing plaintext access/refresh tokens in console / command line shell
    debug('SET opds authentication credentials for', host); // data

    const id = `${Buffer.from(host).toString('base64')}`;
    this._data[id] = data;
  }

  public getAuthenticationToken(host: string) {
    const id = `${Buffer.from(host).toString('base64')}`;
    return this._data[id];
  }

  public deleteAuthenticationToken(host: string) {
    const id = `${Buffer.from(host).toString('base64')}`;
    delete this._data[id];
  }

  public wipeAuthenticationStorage() {
    this._data = {};
  }

  public get data(): TAuthenticationStorage {
    return this.data;
  }
}
