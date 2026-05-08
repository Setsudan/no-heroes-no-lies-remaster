const DEFAULT_API_BASE_URL = "http://localhost:4000";

const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE_URL;

interface RequestOptions extends RequestInit {
  parseAs?: "json" | "text" | "none";
}

async function request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  const { parseAs = "json", headers, ...init } = options;

  const response = await fetch(API_BASE_URL + path, {
    credentials: "include",
    headers: headers ?? {},
    ...init
  });

  if (parseAs === "none") {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return undefined as TResponse;
  }

  if (parseAs === "text") {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Request failed with status ${response.status}`);
    }
    return text as TResponse;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const hasBody = text.length > 0;
  let data: unknown = null;

  if (hasBody) {
    try {
      data = JSON.parse(text);
    } catch {
      if (contentType.includes("application/json")) {
        throw new Error("Failed to parse response");
      }
      throw new Error("Failed to parse response");
    }
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === "object" && "error" in data && typeof (data as any).error === "string"
        ? (data as any).error
        : undefined) ?? `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as TResponse;
}

export function getJson<TResponse>(path: string): Promise<TResponse> {
  return request<TResponse>(path, { method: "GET" });
}

export function postJson<TResponse, TBody = unknown>(path: string, body?: TBody): Promise<TResponse> {
  const init: RequestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return request<TResponse>(path, init);
}

export function postNoContent<TBody = unknown>(path: string, body?: TBody): Promise<void> {
  const init: RequestOptions = { method: "POST", parseAs: "none" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return request<void>(path, init);
}

export function getText(path: string): Promise<string> {
  return request<string>(path, { method: "GET", parseAs: "text" });
}

