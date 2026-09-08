export function abortError(message = "Сканирование остановлено"): DOMException {
  return new DOMException(message, "AbortError");
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}
