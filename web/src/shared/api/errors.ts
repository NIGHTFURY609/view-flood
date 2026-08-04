import type { ApiErrorBody } from "@/shared/types/api";

/**
 * Every non-2xx response becomes one of these. Components branch on `code`
 * and render a translated string — backend prose is never shown to a user,
 * so error copy stays in the EN/ML dictionaries.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Readonly<Record<string, string>> | null;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Readonly<Record<string, string>> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** True for conditions a retry cannot fix. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isOffline(): boolean {
    return this.code === "network_error";
  }
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorBody).error === "object"
  ) {
    const { code, message, fields } = (body as ApiErrorBody).error;
    return new ApiError(status, code || "unknown", message || "Request failed", fields ?? null);
  }
  return new ApiError(status, "unknown", `Request failed with status ${status}`);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
