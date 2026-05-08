# Master Data Services (MDS) — Demo Package

A Semarchy / Profisee–style Master Data Management web app with:

- **Dashboard** with KPI tiles (entities, golden records, DQ, open tasks)
- **Data Grid** — inline edit golden records with cell-level audit
- **Match & Merge** — duplicate detection + side-by-side survivorship merge
- **Data Quality** — scorecards by Completeness · Uniqueness · Validity · Timeliness
- **Stewardship Inbox** — unified queue for DQ failures, merge candidates, drift, enrichment, approvals
- **Hierarchy Editor** — drag-and-drop parent-child tree
- **Business Glossary** — terms, definitions, ownership, linked attributes
- **Entity Modeler** — entities + relationships diagram
- **History (SCD2)** — rolling 6-month versioned snapshots
- **Reconciliation** — cross-system drift (MDS · Lakehouse · Salesforce · Oracle Fusion)
- **Record Inspector** — per-record audit · history · XREF (source-system mappings)

Stack: **React + Vite** frontend · **Node + Express + oracledb** backend · **Oracle 21c** (dev) / **SQL Server** (production target).

---

## Layout

```
mds-demo/
├── src/                  React frontend
│   ├── App.jsx           shell + routing
│   ├── views/            one per nav item (Dashboard, DataGrid, MatchMerge, DataQuality,
│   │                       Stewardship, Hierarchy, Glossary, EntityModel, History,
│   │                       Reconcile, AuditPanel)
│   ├── components/       Header, Toast, Modal
│   └── lib/              api.js (fetch wrapper), styles.js (tokens)
├── backend/              Node + Express + oracledb
│   ├── server.js         app + route mounting
│   ├── lib/db.js         oracledb connection pool
│   ├── routes/           one router per resource
│   ├── .env.example      copy to .env, fill in DB credentials
│   └── package.json
├── sql/
│   ├── oracle/
│   │   ├── 00_create_user.sql      (run as SYS — creates MDS user)
│   │   ├── 01_schema.sql           (21 tables + indexes)
│   │   └── 02_seed.sql             (templates, golden records, DQ, matches, glossary, …)
│   ├── sqlserver/
│   │   └── 01_schema.sql           SQL Server equivalent (T-SQL syntax)
│   └── run_oracle.py               idempotent Python runner
└── package.json          root scripts (dev, api, db:setup, start)
```

---

## Setup (Oracle / dev)

### 1. Create the MDS schema

The MDS user has already been created on the local Oracle 21c XE container at `localhost:1521/ARCOREDB`. To recreate it elsewhere:

```bash
sqlplus sys/<SYS_PASSWORD>@localhost:1521/ARCOREDB AS SYSDBA @sql/oracle/00_create_user.sql
```

### 2. Apply schema + seed

```bash
python -m pip install oracledb
python sql/run_oracle.py            # creates 21 tables + seed data
python sql/run_oracle.py --drop     # full reset
python sql/run_oracle.py --seed     # seed only
```

The script is idempotent — `ORA-00955` (object exists) and `ORA-00001` (PK conflict) are silently skipped.

### 3. Configure backend

```bash
cp backend/.env.example backend/.env
# edit if needed — defaults:
# MDS_DB_USER=MDS
# MDS_DB_PASSWORD=<MDS_PASSWORD>
# MDS_DB_CONNECT_STRING=localhost:1521/ARCOREDB
# PORT=4000
```

### 4. Install + run

```bash
npm install                # root (frontend + concurrently)
npm run api:install        # backend deps (express, oracledb, …)

npm run start              # spawns API + Vite together
# OR separately:
npm run api                # http://localhost:4000
npm run dev                # http://localhost:5173
```

Open `http://localhost:5173`.

---

## Setup (SQL Server / client production)

The `sql/sqlserver/01_schema.sql` file mirrors the Oracle DDL using T-SQL types
(`NVARCHAR(MAX)`, `DATETIME2`, `BIT`, `IDENTITY`-friendly defaults).

```sql
-- in SSMS / sqlcmd
CREATE DATABASE MDS;
GO
USE MDS;
GO
:r sql\sqlserver\01_schema.sql
```

To wire the backend to SQL Server instead of Oracle, swap the driver in `backend/lib/db.js`
to `mssql` and replace the `oracledb`-specific calls (the SQL is portable apart from a
small handful of dialect differences flagged with comments in the seed file).

---

## API surface

| Method | Path                                  | Purpose                                |
|--------|---------------------------------------|----------------------------------------|
| GET    | `/api/health`                          | Pool status                            |
| GET    | `/api/users`                           | List demo users                        |
| GET    | `/api/templates`                       | Entity definitions + columns           |
| GET    | `/api/records/:tmpl`                   | Current golden records for an entity   |
| POST   | `/api/records/:tmpl`                   | Insert golden record (+audit)          |
| PUT    | `/api/records/:id`                     | Update (writes prior version → history, logs cell-level audit) |
| GET    | `/api/dq/overview`                     | Aggregate scorecard per entity         |
| GET    | `/api/dq/scorecards`                   | Raw dimension scores                   |
| GET    | `/api/dq/rules/:tmpl?`                 | DQ rules                               |
| GET    | `/api/match/groups[?status=]`          | Match groups                           |
| GET    | `/api/match/groups/:id`                | Group + candidates + payloads          |
| POST   | `/api/match/groups/:id/resolve`        | Apply survivorship                     |
| POST   | `/api/match/groups/:id/dismiss`        | Mark as not-a-duplicate                |
| GET    | `/api/hierarchy`                       | List hierarchies                       |
| GET    | `/api/hierarchy/:id/tree`              | Nested tree                            |
| PUT    | `/api/hierarchy/nodes/:id/move`        | Reparent node (drag-drop)              |
| GET    | `/api/glossary`                        | Business terms                         |
| POST   | `/api/glossary`                        | Create term                            |
| GET    | `/api/xref/record/:id`                 | Source-system mappings                 |
| GET    | `/api/audit/record/:id`                | Per-record audit trail                 |
| GET    | `/api/history/template/:tmpl`          | 6-month rolling SCD2 snapshots         |
| GET    | `/api/tasks[?status=&assigned_to=]`    | Stewardship queue                      |
| PUT    | `/api/tasks/:id`                       | Reassign / status change               |
| GET    | `/api/workflow/requests[?status=]`     | Approval requests                      |
| POST   | `/api/workflow/requests/:id/transition`| Move stage / approve / reject          |
| GET    | `/api/reconcile`                       | Cross-system drift                     |
| GET    | `/api/entity-model`                    | Entities + columns + relationships     |

---

## Data model — 21 tables

| Table                      | Purpose                                          |
|----------------------------|--------------------------------------------------|
| `mds_template`             | One row per entity definition                    |
| `mds_template_column`      | Column metadata (type, required, options)        |
| `mds_golden_record`        | Current authoritative records (JSON payload)     |
| `mds_record_history`       | SCD2 snapshots (rolling 6 months)                |
| `mds_audit_log`            | Cell-level change log                            |
| `mds_match_group`          | Duplicate-candidate groups                       |
| `mds_match_candidate`      | Records per group + similarity                   |
| `mds_survivorship_rule`    | Field-level merge strategies                     |
| `mds_dq_rule`              | DQ rule registry                                 |
| `mds_dq_result`            | Per-record DQ outcomes                           |
| `mds_dq_scorecard`         | Aggregate dimension scores                       |
| `mds_hierarchy`            | Hierarchy definitions                            |
| `mds_hierarchy_node`       | Nodes (adjacency-list, recursive)                |
| `mds_xref`                 | Cross-references (golden ↔ source-system keys)   |
| `mds_glossary_term`        | Business glossary                                |
| `mds_workflow_request`     | Approval requests                                |
| `mds_workflow_step`        | Workflow stage history                           |
| `mds_stewardship_task`     | Unified task inbox                               |
| `mds_entity_relationship`  | Entity Modeler edges                             |
| `mds_reconciliation`       | Cross-system drift records                       |
| `mds_user`                 | Demo users (Admin · Editor · Steward · Viewer)   |

---

## Notes

- Frontend uses inline-style components (no CSS framework) — easy to skin with the
  same pattern as Semarchy/Profisee in client branding.
- The backend uses `oracledb` in **thin mode** (no Oracle Instant Client required).
- Audit + history are written transactionally on every record update — no triggers
  needed; the API layer handles versioning.
- The 6-month retention is enforced by `POST /api/history/purge`; schedule this
  daily in production via SQL Server Agent / Oracle DBMS_SCHEDULER.
- Authentication is stubbed (user picker in header). Wire to Microsoft Entra ID
  in production by replacing the `users` route + adding token validation
  middleware.
