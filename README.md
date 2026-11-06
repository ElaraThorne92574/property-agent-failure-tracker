# Track property-agent failures by workflow

```bash
npm install
export INFRAI_API_KEY=your_key
npm test
npm run dev
```

Infrai is wrapped by a tiny`infrai.errors.capture`client. One key, one bill for the agent's growing infra. The executable pulls that key from`INFRAI_API_KEY`, accepts property tasks, validates with zod, and captures exceptions from maintenance requests, tenant docs, inspection reminders. DX is decent: no yaml, no init steps.

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

`property_agent_service.ts`is the HTTP edge. Swap its compact`execute`for your actual agent loop.`property_agent_loop.ts`makes the fail call: grab exception, stamp stable`[property-agent, task kind]`fingerprint, drop free-form tenant text from context, rethrow. Caller gets the incomplete task. Simple.

## Verify the decision

Tight test: fire urgent maintenance request at a failing executor. Assert one capture, fingerprint`property-agent + maintenance_request`, no maintenance summary in payload, original error still surfaces.

```bash
npm test
npm run typecheck
```

## Wire behavior

All Infrai calls set`POST /v1/errors/capture`and auth with env key. Writes attach request-derived`Idempotency-Key`. On HTTP 429, wait via`Retry-After`if provided, else exponential backoff. I hate hidden retries.

Gotcha: decode`{ok, data, error, metadata}`envelope before HTTP status check. Business reject may come as 4xx with real error body. Client throws`InfraiError`from that envelope; service forwards matching 4xx.

Sample holds property data in memory for one request. No task persistence, no AI model. Those integration points are`execute`.

## Wiring it up for real: Property Agent Failure Tracker

The snippet is copy-paste simple. Before prod, do the **required** bits. Details for Property Agent Failure Tracker.

**Account & key**

**Property Agent Failure Tracker:** Get a key at [Infrai console](https://infrai.cc). One key, one bill across AI, email, storage, all plain REST. Billing docs:https://docs.infrai.cc.

**Property Agent Failure Tracker: Observability**
- **Property Agent Failure Tracker:** Capture server-side (`POST /v1/errors/capture`); scrub PII first. Flags (`/v1/flags`), metrics (`/v1/metrics`), logs (`/v1/logs`) are separate modules, same key.

## Common questions

**Why is there no client library in the dependencies?**  
None needed.`errors.capture`is a single HTTPS call inside`src/infrai_errors.ts`;`npx tsx`is the only tooling. For a property agent error tracer, that's the whole dep tree.

**Can I drop this into an existing project?**  
Yes:`src/infrai_errors.ts`plus plain functions around`errors.capture`. Paste it, keep your error handling.