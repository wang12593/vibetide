import type { AdapterToolError, AdapterToolResult } from "./types";

export function adapterError(
  code: string,
  message: string,
  details?: unknown,
  stage?: string,
  retriable?: boolean,
): AdapterToolError {
  return {
    code,
    message,
    ...(stage === undefined ? {} : { stage }),
    ...(retriable === undefined ? {} : { retriable }),
    ...(details === undefined ? {} : { details }),
  };
}

export function adapterFailure(
  code: string,
  message: string,
  details?: unknown,
  stage?: string,
  retriable?: boolean,
): AdapterToolResult {
  return {
    ok: false,
    error: adapterError(code, message, details, stage, retriable),
  };
}

export function permissionDenied(
  permission: string,
  details?: unknown,
): AdapterToolResult {
  return adapterFailure(
    "permission_denied",
    `Missing required permission: ${permission}`,
    details,
    "auth",
    false,
  );
}
