/* eslint-disable @typescript-eslint/no-explicit-any */
import { ofetch } from "ofetch";
import { ApiResponse } from "@/lib/api-response";

type Method =
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS";

const request = async <T = any>(
  method: Method,
  url: string,
  data: {
    params?: Record<string, any>;
    body?: Record<string, any> | FormData;
    headers?: HeadersInit;
  }
): Promise<T> => {
  return await ofetch<T>(url, {
    method,
    baseURL: `${process.env["NEXT_PUBLIC_BASE_URL"] || "http://127.0.0.1:3000"}${process.env["NEXT_PUBLIC_BASE_PATH"] || ""}`,
    params: data.params,
    headers: data.headers,
    credentials: "include",
    body: data.body,
    timeout: 1000 * 60 * 5,
  });
};

const service = {
  async get<T = any>(
    url: string,
    data?: Record<string, any>,
    headers?: HeadersInit
  ): Promise<T> {
    return await request("GET", url, { params: data, headers });
  },

  async post<T = any>(url: string, data?: Record<string, any> | FormData): Promise<T> {
    return await request("POST", url, { body: data });
  },

  async put<T = any>(url: string, data?: Record<string, any>): Promise<T> {
    return await request("PUT", url, { body: data });
  },

  async delete<T = any>(url: string, data?: object): Promise<T> {
    return await request("DELETE", url, { params: data });
  },
};

export default service;

export type Res<T> = ApiResponse<T>;
