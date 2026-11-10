import type { Document } from "@/lib/documents/types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as
    | (T & ErrorBody)
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      body?.error?.message ?? "The request could not be completed.",
      response.status,
      body?.error?.code ?? "request_failed",
    );
  }

  return body as T;
}

export const documentsApi = {
  async list(): Promise<Document[]> {
    const body = await request<{ documents: Document[] }>("/api/documents", {
      method: "GET",
      cache: "no-store",
    });
    return body.documents;
  },

  async get(id: string): Promise<Document> {
    return request<Document>(`/api/documents/${encodeURIComponent(id)}`, {
      method: "GET",
      cache: "no-store",
    });
  },

  async create(input: {
    type: string;
    name?: string;
  }): Promise<Document> {
    return request<Document>("/api/documents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async rename(id: string, name: string): Promise<Document> {
    return request<Document>(
      `/api/documents/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name }),
      },
    );
  },

  async delete(id: string): Promise<void> {
    await request<void>(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
