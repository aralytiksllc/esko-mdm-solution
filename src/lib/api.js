// Lightweight fetch wrapper. Override base via VITE_API_BASE.
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (p) => req("GET", p),
  post: (p, b) => req("POST", p, b),
  put: (p, b) => req("PUT", p, b),
  del: (p) => req("DELETE", p),

  templates: (role = null) => req("GET", `/templates${role ? "?role=" + encodeURIComponent(role) : ""}`),
  createTemplate: (body) => req("POST", "/templates", body),
  deleteTemplate: (k) => req("DELETE", `/templates/${k}`),
  addColumn: (k, body) => req("POST", `/templates/${k}/columns`, body),
  removeColumn: (k, name) => req("DELETE", `/templates/${k}/columns/${encodeURIComponent(name)}`),
  records: (k) => req("GET", `/records/${k}`),
  createRecord: (k, body) => req("POST", `/records/${k}`, body),
  updateRecord: (id, body) => req("PUT", `/records/${id}`, body),
  bulkRecords: (k, body) => req("POST", `/records/${k}/bulk`, body),

  publishStatus: (k) => req("GET", `/publish/status${k ? "/" + k : ""}`),
  publishSql: (k, user, role = null) => req("POST", `/publish/sql/${k}`, { user, role }),
  publishLakehouse: (k, user, role = null) => req("POST", `/publish/lakehouse/${k}`, { user, role }),

  getLock: (k) => req("GET", `/locks/${k}`),
  acquireLock: (k, body) => req("POST", `/locks/${k}/acquire`, body),
  releaseLock: (k, body) => req("POST", `/locks/${k}/release`, body),

  provisioning: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req("GET", `/provisioning${qs ? "?" + qs : ""}`);
  },
  provisioningById: (id) => req("GET", `/provisioning/${id}`),
  provisioningPendingSummary: () => req("GET", "/provisioning/_summary/pending"),
  deployProvisioning: (id, body) => req("POST", `/provisioning/${id}/deploy`, body),
  rejectProvisioning: (id, body) => req("POST", `/provisioning/${id}/reject`, body),

  dqOverview: () => req("GET", "/dq/overview"),
  dqScorecards: () => req("GET", "/dq/scorecards"),
  dqRules: (k) => req("GET", `/dq/rules${k ? "/" + k : ""}`),

  matchGroups: (status) => req("GET", `/match/groups${status ? "?status=" + status : ""}`),
  matchGroup: (id) => req("GET", `/match/groups/${id}`),
  resolveMatch: (id, body) => req("POST", `/match/groups/${id}/resolve`, body),
  dismissMatch: (id, body) => req("POST", `/match/groups/${id}/dismiss`, body),
  survivorshipRules: (k) => req("GET", `/match/survivorship-rules/${k}`),

  hierarchies: () => req("GET", "/hierarchy"),
  hierarchyTree: (id) => req("GET", `/hierarchy/${id}/tree`),
  moveNode: (id, parent) => req("PUT", `/hierarchy/nodes/${id}/move`, { new_parent: parent }),
  addNode: (hid, body) => req("POST", `/hierarchy/${hid}/nodes`, body),
  deleteNode: (id) => req("DELETE", `/hierarchy/nodes/${id}`),

  glossary: () => req("GET", "/glossary"),
  createTerm: (body) => req("POST", "/glossary", body),
  updateTerm: (id, body) => req("PUT", `/glossary/${id}`, body),
  deleteTerm: (id) => req("DELETE", `/glossary/${id}`),

  xrefForRecord: (id) => req("GET", `/xref/record/${id}`),
  xrefForTemplate: (k) => req("GET", `/xref/template/${k}`),

  auditForRecord: (id) => req("GET", `/audit/record/${id}`),
  auditForTemplate: (k) => req("GET", `/audit/template/${k}`),

  tasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req("GET", `/tasks${qs ? "?" + qs : ""}`);
  },
  taskSummary: () => req("GET", "/tasks/summary"),
  updateTask: (id, body) => req("PUT", `/tasks/${id}`, body),

  workflowRequests: (status) => req("GET", `/workflow/requests${status ? "?status=" + status : ""}`),
  workflowSteps: (id) => req("GET", `/workflow/requests/${id}/steps`),
  createRequest: (body) => req("POST", "/workflow/requests", body),
  transitionRequest: (id, body) => req("POST", `/workflow/requests/${id}/transition`, body),

  reconcile: (k) => req("GET", `/reconcile${k ? "?template_key=" + k : ""}`),
  reconcileSummary: () => req("GET", "/reconcile/summary"),

  history: (id) => req("GET", `/history/record/${id}`),
  historyByTemplate: (k) => req("GET", `/history/template/${k}`),

  entityModel: () => req("GET", "/entity-model"),
  users: () => req("GET", "/users"),
};
