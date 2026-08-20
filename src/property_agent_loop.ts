import { z } from "zod";
import type { InfraiErrors } from "./infrai_errors.js";

export const propertyTaskSchema = z.discriminatedUnion("kind", [
  z.object({
    requestId: z.string().min(1),
    propertyId: z.string().min(1),
    kind: z.literal("maintenance_request"),
    summary: z.string().min(1),
    priority: z.enum(["routine", "urgent"]),
  }),
  z.object({
    requestId: z.string().min(1),
    propertyId: z.string().min(1),
    kind: z.literal("tenant_document"),
    documentType: z.enum(["lease", "insurance", "identity"]),
  }),
  z.object({
    requestId: z.string().min(1),
    propertyId: z.string().min(1),
    kind: z.literal("inspection_reminder"),
    inspectionDate: z.string().date(),
  }),
]);

export type PropertyTask = z.infer<typeof propertyTaskSchema>;
export type AgentOutput = { action: string; reference: string };
export type AgentExecutor = (task: PropertyTask) => Promise<AgentOutput>;

export async function runPropertyAgent(
  task: PropertyTask,
  execute: AgentExecutor,
  infrai: InfraiErrors,
): Promise<AgentOutput> {
  try {
    return await execute(task);
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    await infrai.errors.capture(
      {
        message: `property-agent/${task.kind} failed`,
        level: "error",
        fingerprint: ["property-agent", task.kind],
        exception: {
          type: error.name,
          value: error.message,
          stacktrace: error.stack,
        },
        context: {
          request_id: task.requestId,
          property_id: task.propertyId,
          task_kind: task.kind,
        },
      },
      `property-agent:${task.requestId}`,
    );
    throw error;
  }
}
