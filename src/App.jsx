import { useState, useEffect, useCallback } from "react";
import { api } from "./lib/api.js";
import { colors } from "./lib/styles.js";
import { Header } from "./components/Header.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { Toast } from "./components/Toast.jsx";
import { Dashboard } from "./views/Dashboard.jsx";
import { DataGrid } from "./views/DataGrid.jsx";
import { MatchMerge } from "./views/MatchMerge.jsx";
import { DataQuality } from "./views/DataQuality.jsx";
import { Stewardship } from "./views/Stewardship.jsx";
import { Hierarchy } from "./views/Hierarchy.jsx";
import { Glossary } from "./views/Glossary.jsx";
import { EntityModel } from "./views/EntityModel.jsx";
import { History } from "./views/History.jsx";
import { Reconcile } from "./views/Reconcile.jsx";
import { Provisioning } from "./views/Provisioning.jsx";
import { AuditPanel } from "./views/AuditPanel.jsx";

export default function MDSApp() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(null);
  const [auditFor, setAuditFor] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [provisioningPending, setProvisioningPending] = useState(0);
  const [notification, setNotification] = useState(null);
  const [bootError, setBootError] = useState(null);

  const notify = useCallback((msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const reloadTemplates = useCallback(async (role = null) => {
    try {
      const r = role ?? currentUser?.role_name ?? null;
      const t = await api.templates(r);
      setTemplates(t);
      return t;
    } catch (e) { setBootError(e.message); }
  }, [currentUser?.role_name]);

  const reloadProvisioning = useCallback(async () => {
    try {
      const rows = await api.provisioning({ status: "pending" });
      setProvisioningPending(rows.length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    api.users()
      .then(u => {
        setUsers(u);
        setCurrentUser(u[0]);
        return api.templates(u[0]?.role_name).then(setTemplates);
      })
      .catch(e => setBootError(e.message));
    api.tasks({ status: "open" }).then(ts => setTaskCount(ts.length)).catch(() => {});
    reloadProvisioning();
  }, []);

  // Re-fetch templates whenever the current user (role) changes
  useEffect(() => {
    if (currentUser?.role_name) reloadTemplates(currentUser.role_name);
  }, [currentUser?.role_name, reloadTemplates]);

  const openTemplate = (key) => {
    setSelectedTemplateKey(key);
    setActiveView("grid");
  };

  if (bootError) {
    return (
      <div style={{ padding: 40, fontFamily: "Segoe UI", maxWidth: 700, margin: "60px auto" }}>
        <h2 style={{ color: colors.accentRed }}>Backend not reachable</h2>
        <p>{bootError}</p>
        <pre style={{ background: "#f3f4f6", padding: 16, borderRadius: 8, fontSize: 13 }}>
{`Make sure the API is running:

  cd backend
  npm install
  npm run dev

Then refresh this page.`}
        </pre>
      </div>
    );
  }

  if (!currentUser) {
    return <div style={{ padding: 40, fontFamily: "Segoe UI" }}>Loading…</div>;
  }

  const tmplObj = templates.find(t => t.template_key === selectedTemplateKey);

  return (
    <div style={{ fontFamily: "'Segoe UI', -apple-system, sans-serif", background: colors.bg, minHeight: "100vh", color: colors.ink }}>
      <Toast notification={notification} />
      <Header
        users={users}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          taskCount={taskCount}
          provisioningPending={provisioningPending}
        />

        <main style={{ flex: 1, minWidth: 0, padding: "24px 28px", maxWidth: 1500 }}>
        {activeView === "dashboard" && (
          <Dashboard templates={templates} currentUser={currentUser} openTemplate={openTemplate} setActiveView={setActiveView} notify={notify} reloadTemplates={reloadTemplates} reloadProvisioning={reloadProvisioning} />
        )}
        {activeView === "grid" && (
          <DataGrid template={tmplObj} currentUser={currentUser} notify={notify} openAuditFor={setAuditFor} reloadTemplates={reloadTemplates} reloadProvisioning={reloadProvisioning} setActiveView={setActiveView} />
        )}
        {activeView === "provisioning" && (
          <Provisioning currentUser={currentUser} notify={(m, t) => { notify(m, t); reloadProvisioning(); }} />
        )}
        {activeView === "match" && (
          <MatchMerge currentUser={currentUser} notify={notify} />
        )}
        {activeView === "dq" && (
          <DataQuality templates={templates} notify={notify} />
        )}
        {activeView === "stewardship" && (
          <Stewardship users={users} currentUser={currentUser} notify={notify} onTaskCountChange={setTaskCount} />
        )}
        {activeView === "hierarchy" && (
          <Hierarchy currentUser={currentUser} notify={notify} />
        )}
        {activeView === "glossary" && (
          <Glossary templates={templates} currentUser={currentUser} notify={notify} />
        )}
        {activeView === "model" && (
          <EntityModel notify={notify} />
        )}
        {activeView === "history" && (
          <History templates={templates} notify={notify} />
        )}
        {activeView === "reconcile" && (
          <Reconcile notify={notify} />
        )}
        </main>
      </div>

      {auditFor && <AuditPanel record={auditFor} onClose={() => setAuditFor(null)} />}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        input[type="checkbox"] { accent-color: #e94560; width: 15px; height: 15px; cursor: pointer; }
        select:focus, input:focus, textarea:focus { outline: 2px solid #e94560; outline-offset: -1px; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
      `}</style>
    </div>
  );
}
