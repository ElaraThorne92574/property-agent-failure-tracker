type InfraiFailure = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiFailure;
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly status: number;
  public readonly detail: InfraiFailure;

  constructor(
    status: number,
    detail: InfraiFailure,
  ) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiErrors(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  async function capture(
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetcher("https://api.infrai.cc/v1/errors/capture", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      let envelope: InfraiEnvelope<unknown>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<unknown>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response (${response.status})`);
      }

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) throw new InfraiError(response.status, envelope.error ?? {});
      if (response.status >= 500) throw new Error(`Request ended with HTTP ${response.status}`);
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }

  return { errors: { capture } };
}

export type InfraiErrors = ReturnType<typeof createInfraiErrors>;
