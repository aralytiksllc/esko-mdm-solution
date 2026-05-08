import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, ".env") });

import express from "express";
import cors from "cors";
import { initPool, closePool } from "./lib/db.js";
import templates from "./routes/templates.js";
import records from "./routes/records.js";
import dq from "./routes/dq.js";
import match from "./routes/match.js";
import hierarchy from "./routes/hierarchy.js";
import glossary from "./routes/glossary.js";
import xref from "./routes/xref.js";
import audit from "./routes/audit.js";
import tasks from "./routes/tasks.js";
import workflow from "./routes/workflow.js";
import reconcile from "./routes/reconcile.js";
import history from "./routes/history.js";
import entityModel from "./routes/entityModel.js";
import users from "./routes/users.js";
import publish from "./routes/publish.js";
import provisioning from "./routes/provisioning.js";
import locks from "./routes/locks.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/templates", templates);
app.use("/api/records", records);
app.use("/api/dq", dq);
app.use("/api/match", match);
app.use("/api/hierarchy", hierarchy);
app.use("/api/glossary", glossary);
app.use("/api/xref", xref);
app.use("/api/audit", audit);
app.use("/api/tasks", tasks);
app.use("/api/workflow", workflow);
app.use("/api/reconcile", reconcile);
app.use("/api/history", history);
app.use("/api/entity-model", entityModel);
app.use("/api/users", users);
app.use("/api/publish", publish);
app.use("/api/provisioning", provisioning);
app.use("/api/locks", locks);

app.use((err, _req, res, _next) => {
  console.error("[api]", err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 4000;
(async () => {
  await initPool();
  app.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));
})();

process.on("SIGINT", async () => { await closePool(); process.exit(0); });
process.on("SIGTERM", async () => { await closePool(); process.exit(0); });
