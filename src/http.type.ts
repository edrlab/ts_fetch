
import { RequestInit, Response } from "node-fetch";
import { URL } from "url";

export type THttpOptions = RequestInit;
export type THttpResponse = Response;

export interface IHttpGetResult<TData> {
    readonly url: string | URL;
    readonly isFailure: boolean;
    readonly isSuccess: boolean;
    readonly isNetworkError?: boolean;
    readonly isTimeout?: boolean;
    readonly isAbort?: boolean;
    readonly timeoutConnect?: boolean;
    readonly responseUrl?: string;
    readonly statusCode?: number;
    readonly statusMessage?: string;
    contentType?: string;
    // cookies?: string;
    body?: NodeJS.ReadableStream;
    response?: THttpResponse;
    data?: TData;
}

export interface IAuthenticationToken {
    id?: string;
    authenticationUrl?: string; // application/opds-authentication+json
    refreshUrl?: string;
    authenticateUrl?: string;
    accessToken: string;
    refreshToken?: string;
    tokenType?: string;
}

export type THttpGetResultAfterCallback<TData> = Omit<IHttpGetResult<TData>, "body" | "response">;

export type THttpGetCallback<T> =
    (result: IHttpGetResult<T>) =>
        THttpGetResultAfterCallback<T> | Promise<THttpGetResultAfterCallback<T>>;