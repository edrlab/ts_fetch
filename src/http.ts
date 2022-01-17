import * as https from 'https';
import fetch, {Headers, RequestInit} from 'node-fetch';
import {AbortSignal as IAbortSignal} from 'node-fetch/externals';
import {
  IHttpGetResult,
  IAuthenticationToken,
  THttpGetCallback,
  THttpOptions,
  THttpResponse,
} from './http.type';
import {URL} from 'url';
import {AuthenticationStorage} from './AuthenticationStorage';
import {fetchFactory} from './fetch';

// Logger
const debug = console.log;
const IS_DEV = false;

const DEFAULT_HTTP_TIMEOUT = 30000;

// https://github.com/node-fetch/node-fetch/blob/master/src/utils/is-redirect.js
const redirectStatus = new Set([301, 302, 303, 307, 308]);

/**
 * Redirect code matching
 *
 * @param {number} code - Status code
 * @return {boolean}
 */
const isRedirect = (code: number) => {
  return redirectStatus.has(code);
};

export const httpSetHeaderAuthorization = (type: string, credentials: string) =>
  `${type} ${credentials}`;

const handleCallback = async <T = undefined>(
  res: IHttpGetResult<T>,
  callback?: THttpGetCallback<T>
) => {
  if (callback) {
    res = await Promise.resolve(callback(res));

    // remove for IPC sync
    res.body = undefined;
    res.response = undefined;
  }
  return res;
};

const FOLLOW_REDIRECT_COUNTER = 20;

type THttpFetchFormattedResponse = <TData = undefined>(
  url: string | URL,
  options?: RequestInit | undefined,
  callback?: THttpGetCallback<TData> | undefined,
  locale?: string | undefined
) => Promise<IHttpGetResult<TData>>;

interface IHttp {
  httpFetchFormattedResponse: THttpFetchFormattedResponse;
}

export class http implements IHttp {
  private _authenticationStorage: AuthenticationStorage;
  private _fetch: typeof fetch;

  constructor(
    __fetch: typeof fetch | undefined = undefined,
    __authenticationStorage: AuthenticationStorage | undefined = undefined
  ) {
    this._fetch = __fetch || fetchFactory.fetch;
    this._authenticationStorage =
      __authenticationStorage || new AuthenticationStorage();
  }

  private async httpFetchRawResponse(
    url: string | URL,
    options: THttpOptions = {},
    redirectCounter = 0,
    locale = 'en-US'
  ): Promise<THttpResponse> {
    options.headers =
      options.headers instanceof Headers
        ? options.headers
        : new Headers(options.headers || {});
    options.headers.set('user-agent', 'org.edrlab');
    options.headers.set('accept-language', `${locale},en-US;q=0.7,en;q=0.5`);
    options.redirect = 'manual'; // handle cookies

    // https://github.com/node-fetch/node-fetch#custom-agent
    // httpAgent doesn't works // err: Protocol "http:" not supported. Expected "https:
    // this a nodeJs issues !
    //
    // const httpAgent = new http.Agent({
    //     timeout: options.timeout || DEFAULT_HTTP_TIMEOUT,
    // });
    // options.agent = (parsedURL: URL) => {
    //     if (parsedURL.protocol === "http:") {
    //           return httpAgent;
    //     } else {
    //           return httpsAgent;
    //     }
    // };
    if (!options.agent && url.toString().startsWith('https:')) {
      const httpsAgent = new https.Agent({
        timeout: options.timeout || DEFAULT_HTTP_TIMEOUT,
        rejectUnauthorized: IS_DEV ? false : true,
      });
      options.agent = httpsAgent;
    }
    options.timeout = options.timeout || DEFAULT_HTTP_TIMEOUT;

    const response = await this._fetch(url, options);

    debug('fetch URL:', `${url}`);
    debug('Method', options.method);
    debug('Request headers :');
    debug(options.headers);
    debug('###');
    debug('OK: ', response.ok);
    debug('status code :', response.status);
    debug('status text :', response.statusText);

    // manual Redirect to handle cookies
    // https://github.com/node-fetch/node-fetch/blob/0d35ddbf7377a483332892d2b625ec8231fa6181/src/index.js#L129
    if (isRedirect(response.status)) {
      const location = response.headers.get('Location');
      debug('Redirect', response.status, 'to: ', location);

      if (location) {
        const locationUrl = new URL(location, response.url).toString();

        if (redirectCounter > FOLLOW_REDIRECT_COUNTER) {
          throw new Error(`maximum redirect reached at: ${url}`);
        }

        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) &&
            options.method === 'POST')
        ) {
          options.method = 'GET';
          options.body = undefined;
          if (options.headers) {
            if (!(options.headers instanceof Headers)) {
              options.headers = new Headers(options.headers);
            }
            options.headers.delete('content-length');
          }
        }

        return await this.httpFetchRawResponse(
          locationUrl,
          options,
          redirectCounter + 1,
          locale
        );
      } else {
        debug('No location URL to redirect');
      }
    }

    return response;
  }

  // should be private
  public async httpFetchFormattedResponse<TData = undefined>(
    url: string | URL,
    options?: THttpOptions,
    callback?: THttpGetCallback<TData>,
    locale?: string
  ): Promise<IHttpGetResult<TData>> {
    let result: IHttpGetResult<TData> = {
      isFailure: true,
      isSuccess: false,
      url,
    };

    try {
      const response = await this.httpFetchRawResponse(url, options, 0, locale);

      debug('Response headers :');
      debug({...response.headers.raw()});
      debug('###');

      const contentType = response.headers.get('Content-Type') || undefined;
      result = {
        isAbort: false,
        isNetworkError: false,
        isTimeout: false,
        isFailure:
          !response.ok /*response.status < 200 || response.status >= 300*/,
        isSuccess:
          response.ok /*response.status >= 200 && response.status < 300*/,
        url,
        responseUrl: response.url,
        statusCode: response.status,
        statusMessage: response.statusText,
        body: response.body,
        response,
        data: undefined,
        contentType,
        // cookies: response.headers.get("Set-Cookie"),
      };
    } catch (err) {
      const errStr = err.toString();

      debug('### HTTP FETCH ERROR ###');
      debug(errStr);
      debug('url: ', url);
      debug('options: ', options);

      if (err.name === 'AbortError') {
        result = {
          isAbort: true,
          isNetworkError: false,
          isTimeout: false,
          isFailure: true,
          isSuccess: false,
          url,
        };
      } else if (errStr.includes('timeout')) {
        // err.name === "FetchError"
        result = {
          isAbort: false,
          isNetworkError: true,
          isTimeout: true,
          isFailure: true,
          isSuccess: false,
          url,
          statusMessage: errStr,
        };
      } else {
        // err.name === "FetchError"
        result = {
          isAbort: false,
          isNetworkError: true,
          isTimeout: false,
          isFailure: true,
          isSuccess: false,
          url,
          statusMessage: errStr,
        };
      }

      debug('HTTP FAIL RESUlT');
      debug(result);
      debug('#################');
    } finally {
      result = await handleCallback(result, callback);
    }

    return result;
  }

  private httpGetWithAuth =
    (enableAuth = true): THttpFetchFormattedResponse =>
    async (...arg) => {
      const [_url, _options, _callback, ..._arg] = arg;

      const options = _options || {};
      options.method = 'get';

      // const response = await httpFetchFormattedResponse(
      //     _url,
      //     options,
      //     enableAuth ? undefined : _callback,
      //     ..._arg,
      // );

      if (enableAuth) {
        // response.statusCode === 401

        // enableAuth always activate on httpGet request
        // means that on each request the acessToken is returned and not only for the 401 http response
        // specific to 'librarySimplified' server implementation

        const url = _url instanceof URL ? _url : new URL(_url);
        const {host} = url;

        const auth = await this._authenticationStorage.getAuthenticationToken(
          host
        );

        if (typeof auth === 'object' && auth.accessToken) {
          // We have an authentication token for this host.
          // We should use it by default
          // Because we won't always get a 401 response that will ask us to use it.
          return this.httpGetUnauthorized(auth)(
            _url,
            options,
            _callback,
            ..._arg
          );
        }

        // return await handleCallback(response, _callback);
      }

      // return response;
      return this.httpFetchFormattedResponse(_url, options, _callback, ..._arg);
    };

  private httpGetUnauthorized =
    (
      auth: IAuthenticationToken,
      enableRefresh = true
    ): THttpFetchFormattedResponse =>
    async (...arg) => {
      const [_url, _options, _callback, _auth, ..._arg] = arg;

      const url = _url instanceof URL ? _url : new URL(_url);
      const options = _options || {};

      const {accessToken, tokenType} = auth;

      options.headers =
        options.headers instanceof Headers
          ? options.headers
          : new Headers(options.headers || {});

      options.headers.set(
        'Authorization',
        httpSetHeaderAuthorization(tokenType || 'Bearer', accessToken)
      );

      const response = await this.httpGetWithAuth(false)(
        url,
        options,
        enableRefresh ? undefined : _callback,
        _auth,
        ..._arg
      );

      if (enableRefresh) {
        if (response.statusCode === 401) {
          if (auth.refreshUrl && auth.refreshToken) {
            try {
              const responseAfterRefresh =
                await this.httpGetUnauthorizedRefresh(auth)(
                  url,
                  options,
                  _callback,
                  _auth,
                  ..._arg
                );
              return responseAfterRefresh;
            } catch (e) {
              debug('httpGetUnauthorizedRefresh', e);
              return response;
            }
          } else {
            // Most likely because of a wrong access token.
            // In some cases the returned content won't launch a new authentication process
            // It's safer to just delete the access token and start afresh now.
            options.headers.delete('Authorization');

            try {
              const responseWithoutAuth = await this.httpGetWithAuth(false)(
                url,
                options,
                _callback,
                undefined,
                ..._arg
              );
              return responseWithoutAuth;
            } catch (e) {
              debug('httpGetUnauthorizedRefresh', e);
              return response;
            }
          }
        } else {
          return await handleCallback(response, _callback);
        }
      }
      return response;
    };

  private httpGetUnauthorizedRefresh =
    (auth: IAuthenticationToken): THttpFetchFormattedResponse =>
    async (...arg) => {
      const {refreshToken, refreshUrl} = auth;
      const options: RequestInit = {};
      options.headers =
        options.headers instanceof Headers
          ? options.headers
          : new Headers(options.headers || {});
      options.headers.set('Content-Type', 'application/json');

      options.body = JSON.stringify({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const httpPostResponse = await this.post(refreshUrl as string, options);
      if (httpPostResponse.isSuccess && httpPostResponse.response) {
        const jsonDataResponse = await httpPostResponse.response.json();

        const newRefreshToken =
          typeof jsonDataResponse?.refresh_token === 'string'
            ? jsonDataResponse.refresh_token
            : undefined;
        auth.refreshToken = newRefreshToken || auth.refreshToken;

        const newAccessToken =
          typeof jsonDataResponse?.access_token === 'string'
            ? jsonDataResponse.access_token
            : undefined;
        auth.accessToken = newAccessToken || auth.accessToken;

        const httpGetResponse = await this.httpGetUnauthorized(
          auth,
          false
        )(...arg);

        if (httpGetResponse.statusCode !== 401) {
          debug('authenticate with the new access_token');
          debug('saved it into db');
          this._authenticationStorage.setAuthenticationToken(auth);
        }
        return httpGetResponse;
      }

      throw new Error('http post error ' + httpPostResponse.statusMessage);
    };

  public post: THttpFetchFormattedResponse = async (...arg) => {
    let [, options] = arg;

    options = options || {};
    options.method = 'post';
    arg[1] = options;

    // do not risk showing plaintext password in console / command line shell
    // debug("Body:");
    // debug(options.body);

    return this.httpFetchFormattedResponse(...arg);
  };

  public get = this.httpGetWithAuth(true);
}

// fetch checks the class name
// https://github.com/node-fetch/node-fetch/blob/b7076bb24f75be688d8fc8b175f41b341e853f2b/src/utils/is.js#L78
export class AbortSignal implements IAbortSignal {
  public aborted: boolean;
  private listenerArray: any[];

  constructor() {
    this.listenerArray = [];
    this.aborted = false;
  }

  public onabort: IAbortSignal['onabort'] = null;

  // public get aborted() {
  //     return this._aborted;
  // }

  public addEventListener(_type: 'abort', listener: (a: any[]) => any) {
    this.listenerArray.push(listener);
  }

  public removeEventListener(_type: 'abort', listener: (a: any[]) => any) {
    const index = this.listenerArray.findIndex(v => v === listener);
    if (index > -1) {
      this.listenerArray = [
        ...this.listenerArray.slice(0, index),
        ...this.listenerArray.slice(index + 1),
      ];
    }
  }

  public dispatchEvent() {
    this.listenerArray.forEach(l => {
      try {
        l();
      } catch (_e) {
        // ignore
      }
    });
    return (this.aborted = true);
  }
}
