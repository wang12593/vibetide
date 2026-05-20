export function safeErrorResponse(err: unknown, fallbackMessage = "操作失败，请稍后重试") {
  if (process.env.NODE_ENV === "development") {
    return { error: err instanceof Error ? err.message : fallbackMessage };
  }
  return { error: fallbackMessage };
}
