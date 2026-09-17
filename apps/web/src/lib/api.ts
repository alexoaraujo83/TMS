export interface ApiHealth {
  status: string;
  service: string;
}

export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  return value.replace(/\/+$/, "");
}

export async function fetchApiHealth(
  signal?: AbortSignal,
): Promise<ApiHealth> {
  const response = await fetch(`${getApiBaseUrl()}/health`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`API health request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Partial<ApiHealth>;
  if (typeof payload.status !== "string" || typeof payload.service !== "string") {
    throw new Error("API health response contract is invalid");
  }

  return {
    status: payload.status,
    service: payload.service,
  };
}
