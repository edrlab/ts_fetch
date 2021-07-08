import * as nodeFetchCookie from 'fetch-cookie';
import nodeFetch from 'node-fetch';
import * as tough from 'tough-cookie';

export class fetchFactory {
  private static _fetch: typeof nodeFetch;

  private constructor() {
    fetchFactory._fetch = nodeFetch;
  }

  static get fetch() {
    if (!fetchFactory._fetch) {
      new fetchFactory();
    }
    return fetchFactory._fetch;
  }
}

export class fetchCookieFactory {
  private static _fetch: typeof nodeFetch;

  private _cookieJar: tough.CookieJar | undefined;

  private constructor(data?: string | tough.CookieJar.Serialized) {
    this._cookieJar = undefined;

    if (data) {
      this._cookieJar = tough.CookieJar.deserializeSync(data);
    }

    // lazy global var init
    if (!this._cookieJar) {
      this._cookieJar = new tough.CookieJar();
    }

    // https://github.com/edrlab/thorium-reader/issues/1424
    fetchCookieFactory._fetch = nodeFetchCookie(
      nodeFetch,
      this._cookieJar,
      true
    ) as typeof nodeFetch; // ignore errors
  }

  static init(data?: string | tough.CookieJar.Serialized) {
    if (!fetchCookieFactory._fetch) {
      const instance = new fetchCookieFactory(data);
      return instance;
    }
    return this;
  }

  static get fetch() {
    if (!fetchCookieFactory._fetch) {
      fetchCookieFactory._fetch = fetchFactory.fetch;
    }
    return fetchCookieFactory._fetch;
  }

  get cookie(): tough.CookieJar.Serialized | undefined {
    if (this._cookieJar) {
      return this._cookieJar.serializeSync();
    }
    return undefined;
  }

  public async clearCookie(): Promise<void> {
    if (this._cookieJar) {
      await this._cookieJar.removeAllCookies();
    }
  }
}
