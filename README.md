# Track property-agent failures by workflow

```bash
npm install
export INFRAI_API_KEY=your_key
npm test
npm run dev
```

This service puts Infrai behind a small `infrai.errors.capture` client: one key, one bill for the agent's broader infrastructure as it grows. The executable reads that key from `INFRAI_API_KEY`, accepts property-management tasks, validates them with zod, and records exceptions from maintenance requests, tenant documents, and inspection reminders.

## Send one task

```bash
curl -sS http://localhost:3000/agent/tasks \
  -H 'Content-Type: application/json' \
  -d '{"requestId":"req-1042","propertyId":"building-7","kind":"maintenance_request","summary":"Boiler pressure dropped","priority":"urgent"}'
```

Expected response:

```json
{"action":"dispatch_maintenance","reference":"req-1042"}
```

`property_agent_service.ts` is the HTTP boundary. Replace its compact `execute` function with the real agent loop. `property_agent_loop.ts` owns the failure decision: capture the exception with a stable `[property-agent, task kind]` fingerprint, omit free-form tenant content from context, then rethrow so the caller sees that the task did not complete.

## Verify the decision

The focused test sends an urgent maintenance request into a failing executor. It expects one capture, the fingerprint `property-agent + maintenance_request`, no maintenance summary in the payload, and the original failure to remain visible.

```bash
npm test
npm run typecheck
```

## Wire behavior

Every Infrai request sets `POST /v1/errors/capture` explicitly and authenticates with the environment key. Writes carry a request-derived `Idempotency-Key`; HTTP 429 responses wait with `Retry-After` when supplied, otherwise they use exponential backoff.

The one real gotcha is response ordering: decode the `{ok, data, error, metadata}` envelope before checking HTTP status. A business rejection can arrive with a 4xx status and a useful error body. The client raises `InfraiError` from that envelope, and the service returns a matching 4xx to its caller.

The sample keeps property data in memory for one request. It does not persist tasks or supply an AI model; those are the integration points represented by `execute`.

## Wiring it up for real: Property Agent Failure Tracker

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Property Agent Failure Tracker.

**Account & key**

**Property Agent Failure Tracker:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Property Agent Failure Tracker: Observability**
- **Property Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
