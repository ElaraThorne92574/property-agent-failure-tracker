import express from "express";
import { ZodError } from "zod";
import { createInfraiErrors, InfraiError } from "./infrai_errors.js";
import { propertyTaskSchema, runPropertyAgent, type AgentExecutor } from "./property_agent_loop.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = createInfraiErrors(apiKey);
const execute: AgentExecutor = async (task) => ({
  action: task.kind === "maintenance_request" ? "dispatch_maintenance" :
    task.kind === "tenant_document" ? "index_document" : "schedule_notice",
  reference: task.requestId,
});

const service = express();
service.use(express.json({ limit: "32kb" }));

service.post("/agent/tasks", async (request, response) => {
  try {
    const task = propertyTaskSchema.parse(request.body);
    const result = await runPropertyAgent(task, execute, infrai);
    response.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "invalid_property_task", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.status(status).json({ error: error.detail });
      return;
    }
    response.status(503).json({ error: "agent_task_failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
service.listen(port, () => console.log(`property agent listening on :${port}`));
