-- =============================================================
-- MDS (Master Data Services) — Oracle Schema
-- Target schema: MDS
-- Run as: MDS user  (or SYS as sysdba if using ALTER SESSION SET CURRENT_SCHEMA=MDS)
-- =============================================================

-- -------------------------------------------------------------
-- 1. TEMPLATES / ENTITIES  (metadata-driven: one row per MDS template)
-- -------------------------------------------------------------
CREATE TABLE mds_template (
  template_key     VARCHAR2(64)  PRIMARY KEY,
  template_name    VARCHAR2(200) NOT NULL,
  icon             VARCHAR2(10),
  sql_table        VARCHAR2(128),
  bronze_table     VARCHAR2(128),
  phase            VARCHAR2(40),
  approval_chain   VARCHAR2(200),
  supports_period_copy NUMBER(1) DEFAULT 0,
  period_lock_day  NUMBER(2),
  created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT ck_mds_template_period CHECK (supports_period_copy IN (0,1))
);

CREATE TABLE mds_template_column (
  template_key     VARCHAR2(64)  NOT NULL,
  column_ord       NUMBER(3)     NOT NULL,
  column_name      VARCHAR2(128) NOT NULL,
  data_type        VARCHAR2(20)  NOT NULL,   -- text | number | date | select
  is_required      NUMBER(1)     DEFAULT 0,
  is_key           NUMBER(1)     DEFAULT 0,
  options_csv      VARCHAR2(1000),
  validation_rule  VARCHAR2(400),
  CONSTRAINT pk_mds_template_column PRIMARY KEY (template_key, column_ord),
  CONSTRAINT fk_mds_template_column FOREIGN KEY (template_key) REFERENCES mds_template(template_key) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- 2. GOLDEN RECORDS (current master data)
-- -------------------------------------------------------------
CREATE TABLE mds_golden_record (
  record_id        VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  business_key     VARCHAR2(200) NOT NULL,   -- e.g. PC-001, BE0001
  payload_json     CLOB          NOT NULL,
  dq_score         NUMBER(5,2),              -- 0..100
  match_group_id   VARCHAR2(64),
  confidence       NUMBER(5,2),              -- survivorship confidence
  source_system    VARCHAR2(64),             -- dominant source
  valid_from       TIMESTAMP     DEFAULT SYSTIMESTAMP,
  valid_to         TIMESTAMP,                -- null = current
  is_current       NUMBER(1)     DEFAULT 1,
  status           VARCHAR2(20)  DEFAULT 'active',   -- active | retired | merged | rejected
  created_by       VARCHAR2(80),
  created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP,
  modified_by      VARCHAR2(80),
  modified_at      TIMESTAMP     DEFAULT SYSTIMESTAMP,
  CONSTRAINT fk_mds_golden_tmpl FOREIGN KEY (template_key) REFERENCES mds_template(template_key),
  CONSTRAINT uq_mds_golden_current UNIQUE (template_key, business_key, is_current)
);
CREATE INDEX ix_mds_golden_tmpl ON mds_golden_record(template_key);
CREATE INDEX ix_mds_golden_key  ON mds_golden_record(business_key);
CREATE INDEX ix_mds_golden_mg   ON mds_golden_record(match_group_id);

-- -------------------------------------------------------------
-- 3. HISTORY (rolling 6 months, SCD2-style snapshots)
-- -------------------------------------------------------------
CREATE TABLE mds_record_history (
  history_id       VARCHAR2(64)  PRIMARY KEY,
  record_id        VARCHAR2(64)  NOT NULL,
  template_key     VARCHAR2(64)  NOT NULL,
  business_key     VARCHAR2(200) NOT NULL,
  payload_json     CLOB          NOT NULL,
  valid_from       TIMESTAMP     NOT NULL,
  valid_to         TIMESTAMP     NOT NULL,
  change_type      VARCHAR2(20),   -- insert | update | delete | merge
  changed_by       VARCHAR2(80),
  changed_at       TIMESTAMP     DEFAULT SYSTIMESTAMP,
  snapshot_month   VARCHAR2(7)   GENERATED ALWAYS AS (TO_CHAR(valid_from,'YYYY-MM')) VIRTUAL
);
CREATE INDEX ix_mds_hist_record ON mds_record_history(record_id);
CREATE INDEX ix_mds_hist_month  ON mds_record_history(snapshot_month);
CREATE INDEX ix_mds_hist_tmpl   ON mds_record_history(template_key);

-- -------------------------------------------------------------
-- 4. AUDIT LOG (every cell-level change)
-- -------------------------------------------------------------
CREATE TABLE mds_audit_log (
  audit_id         VARCHAR2(64)  PRIMARY KEY,
  record_id        VARCHAR2(64),
  template_key     VARCHAR2(64)  NOT NULL,
  business_key     VARCHAR2(200),
  action_type      VARCHAR2(20),   -- create | update | delete | approve | reject | merge | publish
  field_name       VARCHAR2(128),
  old_value        VARCHAR2(4000),
  new_value        VARCHAR2(4000),
  actor            VARCHAR2(80),
  actor_role       VARCHAR2(40),
  batch_id         VARCHAR2(64),
  comment_text     VARCHAR2(1000),
  action_at        TIMESTAMP     DEFAULT SYSTIMESTAMP
);
CREATE INDEX ix_mds_audit_record ON mds_audit_log(record_id);
CREATE INDEX ix_mds_audit_tmpl   ON mds_audit_log(template_key);
CREATE INDEX ix_mds_audit_at     ON mds_audit_log(action_at);

-- -------------------------------------------------------------
-- 5. MATCH & MERGE (Golden-record survivorship)
-- -------------------------------------------------------------
CREATE TABLE mds_match_group (
  match_group_id   VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  status           VARCHAR2(20)  DEFAULT 'pending',   -- pending | merged | rejected | ignored
  match_score      NUMBER(5,2),                        -- 0..100
  surviving_record VARCHAR2(64),
  rule_name        VARCHAR2(200),                      -- e.g. exact-key, fuzzy-name-80
  created_at       TIMESTAMP     DEFAULT SYSTIMESTAMP,
  resolved_by      VARCHAR2(80),
  resolved_at      TIMESTAMP
);

CREATE TABLE mds_match_candidate (
  match_group_id   VARCHAR2(64)  NOT NULL,
  record_id        VARCHAR2(64)  NOT NULL,
  source_system    VARCHAR2(64),
  similarity       NUMBER(5,2),
  is_surviving     NUMBER(1) DEFAULT 0,
  CONSTRAINT pk_mds_match_candidate PRIMARY KEY (match_group_id, record_id),
  CONSTRAINT fk_mds_match_group FOREIGN KEY (match_group_id) REFERENCES mds_match_group(match_group_id) ON DELETE CASCADE
);

CREATE TABLE mds_survivorship_rule (
  rule_id          VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  field_name       VARCHAR2(128) NOT NULL,
  strategy         VARCHAR2(40)  NOT NULL,   -- most_recent | highest_trust | longest | source_priority | non_null
  source_priority  VARCHAR2(400),             -- CSV of source systems in priority order
  active           NUMBER(1) DEFAULT 1
);

-- -------------------------------------------------------------
-- 6. DATA QUALITY
-- -------------------------------------------------------------
CREATE TABLE mds_dq_rule (
  rule_id          VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  field_name       VARCHAR2(128),
  dimension        VARCHAR2(30)  NOT NULL,   -- completeness | uniqueness | validity | timeliness | consistency
  rule_name        VARCHAR2(200) NOT NULL,
  expression       VARCHAR2(2000),
  severity         VARCHAR2(10)  DEFAULT 'warn',  -- info | warn | error
  active           NUMBER(1) DEFAULT 1
);

CREATE TABLE mds_dq_result (
  result_id        VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  rule_id          VARCHAR2(64),
  record_id        VARCHAR2(64),
  dimension        VARCHAR2(30),
  passed           NUMBER(1),
  score            NUMBER(5,2),
  message          VARCHAR2(500),
  measured_at      TIMESTAMP     DEFAULT SYSTIMESTAMP
);
CREATE INDEX ix_mds_dq_result_tmpl ON mds_dq_result(template_key);
CREATE INDEX ix_mds_dq_result_dim  ON mds_dq_result(dimension);

CREATE TABLE mds_dq_scorecard (
  template_key     VARCHAR2(64),
  dimension        VARCHAR2(30),
  score            NUMBER(5,2),
  total_records    NUMBER(10),
  passed_records   NUMBER(10),
  measured_at      TIMESTAMP     DEFAULT SYSTIMESTAMP,
  CONSTRAINT pk_mds_dq_scorecard PRIMARY KEY (template_key, dimension)
);

-- -------------------------------------------------------------
-- 7. HIERARCHIES (adjacency list — recursive queries)
-- -------------------------------------------------------------
CREATE TABLE mds_hierarchy (
  hierarchy_id     VARCHAR2(64)  PRIMARY KEY,
  hierarchy_name   VARCHAR2(200) NOT NULL,
  template_key     VARCHAR2(64),
  description      VARCHAR2(1000),
  created_at       TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE mds_hierarchy_node (
  node_id          VARCHAR2(64)  PRIMARY KEY,
  hierarchy_id     VARCHAR2(64)  NOT NULL,
  parent_node_id   VARCHAR2(64),
  record_id        VARCHAR2(64),              -- link to golden record
  node_label       VARCHAR2(200) NOT NULL,
  node_level       NUMBER(3),
  sort_order       NUMBER(5) DEFAULT 0,
  CONSTRAINT fk_mds_hier FOREIGN KEY (hierarchy_id) REFERENCES mds_hierarchy(hierarchy_id) ON DELETE CASCADE,
  CONSTRAINT fk_mds_hier_parent FOREIGN KEY (parent_node_id) REFERENCES mds_hierarchy_node(node_id)
);
CREATE INDEX ix_mds_hier_parent ON mds_hierarchy_node(parent_node_id);

-- -------------------------------------------------------------
-- 8. CROSS-REFERENCES (XREF — golden ↔ source system keys)
-- -------------------------------------------------------------
CREATE TABLE mds_xref (
  xref_id          VARCHAR2(64)  PRIMARY KEY,
  record_id        VARCHAR2(64)  NOT NULL,
  source_system    VARCHAR2(64)  NOT NULL,   -- Salesforce | Oracle Fusion | SAP | Legacy
  source_key       VARCHAR2(200) NOT NULL,
  source_value     VARCHAR2(4000),
  last_seen_at     TIMESTAMP,
  is_active        NUMBER(1) DEFAULT 1,
  CONSTRAINT uq_mds_xref UNIQUE (source_system, source_key)
);
CREATE INDEX ix_mds_xref_record ON mds_xref(record_id);

-- -------------------------------------------------------------
-- 9. BUSINESS GLOSSARY
-- -------------------------------------------------------------
CREATE TABLE mds_glossary_term (
  term_id          VARCHAR2(64)  PRIMARY KEY,
  term_name        VARCHAR2(200) UNIQUE NOT NULL,
  definition       VARCHAR2(2000),
  category         VARCHAR2(80),
  owner            VARCHAR2(80),
  steward          VARCHAR2(80),
  status           VARCHAR2(20)  DEFAULT 'approved',   -- draft | approved | retired
  related_template VARCHAR2(64),
  related_field    VARCHAR2(128),
  created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- -------------------------------------------------------------
-- 10. WORKFLOW / APPROVALS
-- -------------------------------------------------------------
CREATE TABLE mds_workflow_request (
  request_id       VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  requested_by     VARCHAR2(80)  NOT NULL,
  requested_at     TIMESTAMP     DEFAULT SYSTIMESTAMP,
  row_count        NUMBER(10),
  edited_count     NUMBER(10),
  current_stage    VARCHAR2(80)  DEFAULT 'steward_review',
  status           VARCHAR2(20)  DEFAULT 'pending',  -- pending | approved | rejected | cancelled
  payload_json     CLOB,
  sql_table        VARCHAR2(128),
  resolved_at      TIMESTAMP
);

CREATE TABLE mds_workflow_step (
  step_id          VARCHAR2(64)  PRIMARY KEY,
  request_id       VARCHAR2(64)  NOT NULL,
  stage_name       VARCHAR2(80)  NOT NULL,
  stage_order      NUMBER(3)     NOT NULL,
  actor            VARCHAR2(80),
  action           VARCHAR2(20),   -- approved | rejected | commented
  comment_text     VARCHAR2(1000),
  acted_at         TIMESTAMP,
  CONSTRAINT fk_mds_wf_step FOREIGN KEY (request_id) REFERENCES mds_workflow_request(request_id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- 11. STEWARDSHIP TASKS (unified task inbox)
-- -------------------------------------------------------------
CREATE TABLE mds_stewardship_task (
  task_id          VARCHAR2(64)  PRIMARY KEY,
  task_type        VARCHAR2(40)  NOT NULL,  -- dq_fail | merge_candidate | approval | enrichment | drift
  template_key     VARCHAR2(64),
  record_id        VARCHAR2(64),
  priority         VARCHAR2(10)  DEFAULT 'med',  -- low | med | high | critical
  title            VARCHAR2(400),
  detail           VARCHAR2(2000),
  assigned_to      VARCHAR2(80),
  status           VARCHAR2(20)  DEFAULT 'open',  -- open | in_progress | resolved | dismissed
  created_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
  resolved_at      TIMESTAMP,
  resolved_by      VARCHAR2(80),
  link_ref         VARCHAR2(200)
);
CREATE INDEX ix_mds_task_status ON mds_stewardship_task(status);
CREATE INDEX ix_mds_task_assignee ON mds_stewardship_task(assigned_to);

-- -------------------------------------------------------------
-- 12. ENTITY MODEL (for Entity Modeler diagram)
-- -------------------------------------------------------------
CREATE TABLE mds_entity_relationship (
  relationship_id  VARCHAR2(64)  PRIMARY KEY,
  from_template    VARCHAR2(64)  NOT NULL,
  to_template      VARCHAR2(64)  NOT NULL,
  from_field       VARCHAR2(128),
  to_field         VARCHAR2(128),
  cardinality      VARCHAR2(10)  DEFAULT 'N:1',   -- 1:1 | 1:N | N:1 | N:N
  relationship_name VARCHAR2(200)
);

-- -------------------------------------------------------------
-- 13. RECONCILIATION
-- -------------------------------------------------------------
CREATE TABLE mds_reconciliation (
  recon_id         VARCHAR2(64)  PRIMARY KEY,
  template_key     VARCHAR2(64)  NOT NULL,
  business_key     VARCHAR2(200) NOT NULL,
  sql_value        VARCHAR2(1000),
  lakehouse_value  VARCHAR2(1000),
  salesforce_value VARCHAR2(1000),
  oracle_value     VARCHAR2(1000),
  drift_status     VARCHAR2(20) DEFAULT 'match',  -- match | drift | missing
  detected_at      TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE INDEX ix_mds_recon_tmpl ON mds_reconciliation(template_key);

-- -------------------------------------------------------------
-- 14. PUBLISH LOG (Submit to SQL / Lakehouse trail)
-- -------------------------------------------------------------
CREATE TABLE mds_publish_log (
  publish_id     VARCHAR2(64) PRIMARY KEY,
  template_key   VARCHAR2(64) NOT NULL,
  target         VARCHAR2(20) NOT NULL,   -- sql | lakehouse
  status         VARCHAR2(20) NOT NULL,   -- pending | synced | failed
  row_count      NUMBER(10),
  sql_table      VARCHAR2(128),
  bronze_table   VARCHAR2(128),
  batch_id       VARCHAR2(64),
  submitted_by   VARCHAR2(80),
  submitted_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
  message        VARCHAR2(1000)
);
CREATE INDEX ix_mds_publish_tmpl ON mds_publish_log(template_key, submitted_at DESC);

-- -------------------------------------------------------------
-- 15. USERS (demo-local; in prod use Entra ID)
-- -------------------------------------------------------------
CREATE TABLE mds_user (
  user_id          VARCHAR2(64)  PRIMARY KEY,
  user_name        VARCHAR2(200) NOT NULL,
  role_name        VARCHAR2(40)  NOT NULL,   -- Admin | Editor | Steward | Viewer
  email            VARCHAR2(200),
  avatar_initials  VARCHAR2(4),
  active           NUMBER(1) DEFAULT 1
);
