import type { AdapterToolError, AdapterToolResult } from "./types";

export function adapterError(
  code: string,
  message: string,
  details?: unknown,
): AdapterToolError {
  return {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  };
}

export function adapterFailure(
  code: string,
  message: string,
  details?: unknown,
): AdapterToolResult {
  return {
    ok: false,
    error: adapterError(code, message, details),
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
  );
}
