export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      cache: "no-store",
      signal: options?.signal ?? AbortSignal.timeout(25_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("INTERNAL_ERROR");
  }
  if (!response.ok)
    throw new ApiError(
      typeof body?.error?.code === "string"
        ? body.error.code
        : "INTERNAL_ERROR",
    );
  return body as T;
}
