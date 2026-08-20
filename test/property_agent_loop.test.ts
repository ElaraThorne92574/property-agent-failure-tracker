import assert from "node:assert/strict";
import test from "node:test";
import { runPropertyAgent, type PropertyTask } from "../src/property_agent_loop.js";

test("maintenance failures group by task kind without tenant details", async () => {
  const calls: Array<{ payload: Record<string, unknown>; key: string }> = [];
  const infrai = {
    errors: {
      capture: async (payload: Record<string, unknown>, key: string) => {
        calls.push({ payload, key });
        return { event_id: "evt_test" };
      },
    },
  };
  const task: PropertyTask = {
    requestId: "req-1042",
    propertyId: "building-7",
    kind: "maintenance_request",
    summary: "Boiler pressure dropped",
    priority: "urgent",
  };

  await assert.rejects(
    runPropertyAgent(task, async () => { throw new Error("tool dispatch failed"); }, infrai),
    /tool dispatch failed/,
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].payload.fingerprint, ["property-agent", "maintenance_request"]);
  assert.deepEqual(calls[0].payload.context, {
    request_id: "req-1042",
    property_id: "building-7",
    task_kind: "maintenance_request",
  });
  assert.equal(JSON.stringify(calls[0].payload).includes("Boiler pressure"), false);
  assert.equal(calls[0].key, "property-agent:req-1042");
});
