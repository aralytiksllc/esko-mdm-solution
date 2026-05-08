-- =============================================================
-- MDS (Master Data Services) — SQL Server Schema
-- Target database: MDS  (run CREATE DATABASE MDS separately)
-- Port target: client production environment
-- =============================================================
-- USE MDS;
-- GO

IF SCHEMA_ID('mds') IS NULL EXEC('CREATE SCHEMA mds');
GO

-- 1. TEMPLATES / ENTITIES ----------------------------------------
CREATE TABLE mds.mds_template (
  template_key         VARCHAR(64)  PRIMARY KEY,
  template_name        VARCHAR(200) NOT NULL,
  icon                 VARCHAR(10),
  sql_table            VARCHAR(128),
  bronze_table         VARCHAR(128),
  phase                VARCHAR(40),
  approval_chain       VARCHAR(200),
  supports_period_copy BIT DEFAULT 0,
  period_lock_day      TINYINT,
  created_at           DATETIME2 DEFAULT SYSUTCDATETIME()
);

CREATE TABLE mds.mds_template_column (
  template_key     VARCHAR(64)  NOT NULL,
  column_ord       TINYINT      NOT NULL,
  column_name      VARCHAR(128) NOT NULL,
  data_type        VARCHAR(20)  NOT NULL,
  is_required      BIT DEFAULT 0,
  is_key           BIT DEFAULT 0,
  options_csv      VARCHAR(1000),
  validation_rule  VARCHAR(400),
  CONSTRAINT pk_mds_template_column PRIMARY KEY (template_key, column_ord),
  CONSTRAINT fk_mds_template_column FOREIGN KEY (template_key) REFERENCES mds.mds_template(template_key) ON DELETE CASCADE
);

-- 2. GOLDEN RECORDS ----------------------------------------------
CREATE TABLE mds.mds_golden_record (
  record_id        VARCHAR(64)  PRIMARY KEY,
  template_key     VARCHAR(64)  NOT NULL,
  business_key     VARCHAR(200) NOT NULL,
  payload_json     NVARCHAR(MAX) NOT NULL,
  dq_score         DECIMAL(5,2),
  match_group_id   VARCHAR(64),
  confidence       DECIMAL(5,2),
  source_system    VARCHAR(64),
  valid_from       DATETIME2 DEFAULT SYSUTCDATETIME(),
  valid_to         DATETIME2,
  is_current       BIT DEFAULT 1,
  status           VARCHAR(20) DEFAULT 'active',
  created_by       VARCHAR(80),
  created_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
  modified_by      VARCHAR(80),
  modified_at      DATETIME2 DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_mds_golden_tmpl FOREIGN KEY (template_key) REFERENCES mds.mds_template(template_key)
);
CREATE INDEX ix_mds_golden_tmpl ON mds.mds_golden_record(template_key);
CREATE INDEX ix_mds_golden_key  ON mds.mds_golden_record(business_key);
CREATE INDEX ix_mds_golden_mg   ON mds.mds_golden_record(match_group_id);

-- 3. HISTORY (rolling 6 months) ----------------------------------
CREATE TABLE mds.mds_record_history (
  history_id       VARCHAR(64) PRIMARY KEY,
  record_id        VARCHAR(64) NOT NULL,
  template_key     VARCHAR(64) NOT NULL,
  business_key     VARCHAR(200) NOT NULL,
  payload_json     NVARCHAR(MAX) NOT NULL,
  valid_from       DATETIME2 NOT NULL,
  valid_to         DATETIME2 NOT NULL,
  change_type      VARCHAR(20),
  changed_by       VARCHAR(80),
  changed_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
  snapshot_month   AS CONVERT(VARCHAR(7), valid_from, 120) PERSISTED
);
CREATE INDEX ix_mds_hist_record ON mds.mds_record_history(record_id);
CREATE INDEX ix_mds_hist_month  ON mds.mds_record_history(snapshot_month);
CREATE INDEX ix_mds_hist_tmpl   ON mds.mds_record_history(template_key);

-- 4. AUDIT LOG ---------------------------------------------------
CREATE TABLE mds.mds_audit_log (
  audit_id       VARCHAR(64) PRIMARY KEY,
  record_id      VARCHAR(64),
  template_key   VARCHAR(64) NOT NULL,
  business_key   VARCHAR(200),
  action_type    VARCHAR(20),
  field_name     VARCHAR(128),
  old_value      NVARCHAR(4000),
  new_value      NVARCHAR(4000),
  actor          VARCHAR(80),
  actor_role     VARCHAR(40),
  batch_id       VARCHAR(64),
  comment_text   VARCHAR(1000),
  action_at      DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_mds_audit_record ON mds.mds_audit_log(record_id);
CREATE INDEX ix_mds_audit_tmpl   ON mds.mds_audit_log(template_key);
CREATE INDEX ix_mds_audit_at     ON mds.mds_audit_log(action_at);

-- 5. MATCH & MERGE -----------------------------------------------
CREATE TABLE mds.mds_match_group (
  match_group_id   VARCHAR(64) PRIMARY KEY,
  template_key     VARCHAR(64) NOT NULL,
  status           VARCHAR(20) DEFAULT 'pending',
  match_score      DECIMAL(5,2),
  surviving_record VARCHAR(64),
  rule_name        VARCHAR(200),
  created_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
  resolved_by      VARCHAR(80),
  resolved_at      DATETIME2
);
CREATE TABLE mds.mds_match_candidate (
  match_group_id   VARCHAR(64) NOT NULL,
  record_id        VARCHAR(64) NOT NULL,
  source_system    VARCHAR(64),
  similarity       DECIMAL(5,2),
  is_surviving     BIT DEFAULT 0,
  CONSTRAINT pk_mds_match_candidate PRIMARY KEY (match_group_id, record_id),
  CONSTRAINT fk_mds_match_group FOREIGN KEY (match_group_id) REFERENCES mds.mds_match_group(match_group_id) ON DELETE CASCADE
);
CREATE TABLE mds.mds_survivorship_rule (
  rule_id          VARCHAR(64) PRIMARY KEY,
  template_key     VARCHAR(64) NOT NULL,
  field_name       VARCHAR(128) NOT NULL,
  strategy         VARCHAR(40) NOT NULL,
  source_priority  VARCHAR(400),
  active           BIT DEFAULT 1
);

-- 6. DATA QUALITY ------------------------------------------------
CREATE TABLE mds.mds_dq_rule (
  rule_id      VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(64) NOT NULL,
  field_name   VARCHAR(128),
  dimension    VARCHAR(30) NOT NULL,
  rule_name    VARCHAR(200) NOT NULL,
  expression   VARCHAR(2000),
  severity     VARCHAR(10) DEFAULT 'warn',
  active       BIT DEFAULT 1
);
CREATE TABLE mds.mds_dq_result (
  result_id    VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(64) NOT NULL,
  rule_id      VARCHAR(64),
  record_id    VARCHAR(64),
  dimension    VARCHAR(30),
  passed       BIT,
  score        DECIMAL(5,2),
  message      VARCHAR(500),
  measured_at  DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_mds_dq_result_tmpl ON mds.mds_dq_result(template_key);
CREATE INDEX ix_mds_dq_result_dim  ON mds.mds_dq_result(dimension);

CREATE TABLE mds.mds_dq_scorecard (
  template_key   VARCHAR(64),
  dimension      VARCHAR(30),
  score          DECIMAL(5,2),
  total_records  INT,
  passed_records INT,
  measured_at    DATETIME2 DEFAULT SYSUTCDATETIME(),
  CONSTRAINT pk_mds_dq_scorecard PRIMARY KEY (template_key, dimension)
);

-- 7. HIERARCHIES -------------------------------------------------
CREATE TABLE mds.mds_hierarchy (
  hierarchy_id   VARCHAR(64) PRIMARY KEY,
  hierarchy_name VARCHAR(200) NOT NULL,
  template_key   VARCHAR(64),
  description    VARCHAR(1000),
  created_at     DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE TABLE mds.mds_hierarchy_node (
  node_id        VARCHAR(64) PRIMARY KEY,
  hierarchy_id   VARCHAR(64) NOT NULL,
  parent_node_id VARCHAR(64),
  record_id      VARCHAR(64),
  node_label     VARCHAR(200) NOT NULL,
  node_level     TINYINT,
  sort_order     INT DEFAULT 0,
  CONSTRAINT fk_mds_hier FOREIGN KEY (hierarchy_id) REFERENCES mds.mds_hierarchy(hierarchy_id) ON DELETE CASCADE,
  CONSTRAINT fk_mds_hier_parent FOREIGN KEY (parent_node_id) REFERENCES mds.mds_hierarchy_node(node_id)
);

-- 8. XREF --------------------------------------------------------
CREATE TABLE mds.mds_xref (
  xref_id       VARCHAR(64) PRIMARY KEY,
  record_id     VARCHAR(64) NOT NULL,
  source_system VARCHAR(64) NOT NULL,
  source_key    VARCHAR(200) NOT NULL,
  source_value  NVARCHAR(4000),
  last_seen_at  DATETIME2,
  is_active     BIT DEFAULT 1,
  CONSTRAINT uq_mds_xref UNIQUE (source_system, source_key)
);
CREATE INDEX ix_mds_xref_record ON mds.mds_xref(record_id);

-- 9. BUSINESS GLOSSARY -------------------------------------------
CREATE TABLE mds.mds_glossary_term (
  term_id          VARCHAR(64) PRIMARY KEY,
  term_name        VARCHAR(200) UNIQUE NOT NULL,
  definition       VARCHAR(2000),
  category         VARCHAR(80),
  owner            VARCHAR(80),
  steward          VARCHAR(80),
  status           VARCHAR(20) DEFAULT 'approved',
  related_template VARCHAR(64),
  related_field    VARCHAR(128),
  created_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
  updated_at       DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- 10. WORKFLOW ---------------------------------------------------
CREATE TABLE mds.mds_workflow_request (
  request_id    VARCHAR(64) PRIMARY KEY,
  template_key  VARCHAR(64) NOT NULL,
  requested_by  VARCHAR(80) NOT NULL,
  requested_at  DATETIME2 DEFAULT SYSUTCDATETIME(),
  row_count     INT,
  edited_count  INT,
  current_stage VARCHAR(80) DEFAULT 'steward_review',
  status        VARCHAR(20) DEFAULT 'pending',
  payload_json  NVARCHAR(MAX),
  sql_table     VARCHAR(128),
  resolved_at   DATETIME2
);
CREATE TABLE mds.mds_workflow_step (
  step_id      VARCHAR(64) PRIMARY KEY,
  request_id   VARCHAR(64) NOT NULL,
  stage_name   VARCHAR(80) NOT NULL,
  stage_order  TINYINT NOT NULL,
  actor        VARCHAR(80),
  action       VARCHAR(20),
  comment_text VARCHAR(1000),
  acted_at     DATETIME2,
  CONSTRAINT fk_mds_wf_step FOREIGN KEY (request_id) REFERENCES mds.mds_workflow_request(request_id) ON DELETE CASCADE
);

-- 11. STEWARDSHIP TASKS ------------------------------------------
CREATE TABLE mds.mds_stewardship_task (
  task_id       VARCHAR(64) PRIMARY KEY,
  task_type     VARCHAR(40) NOT NULL,
  template_key  VARCHAR(64),
  record_id     VARCHAR(64),
  priority      VARCHAR(10) DEFAULT 'med',
  title         VARCHAR(400),
  detail        VARCHAR(2000),
  assigned_to   VARCHAR(80),
  status        VARCHAR(20) DEFAULT 'open',
  created_at    DATETIME2 DEFAULT SYSUTCDATETIME(),
  resolved_at   DATETIME2,
  resolved_by   VARCHAR(80),
  link_ref      VARCHAR(200)
);
CREATE INDEX ix_mds_task_status   ON mds.mds_stewardship_task(status);
CREATE INDEX ix_mds_task_assignee ON mds.mds_stewardship_task(assigned_to);

-- 12. ENTITY RELATIONSHIPS ---------------------------------------
CREATE TABLE mds.mds_entity_relationship (
  relationship_id   VARCHAR(64) PRIMARY KEY,
  from_template     VARCHAR(64) NOT NULL,
  to_template       VARCHAR(64) NOT NULL,
  from_field        VARCHAR(128),
  to_field          VARCHAR(128),
  cardinality       VARCHAR(10) DEFAULT 'N:1',
  relationship_name VARCHAR(200)
);

-- 13. RECONCILIATION ---------------------------------------------
CREATE TABLE mds.mds_reconciliation (
  recon_id          VARCHAR(64) PRIMARY KEY,
  template_key      VARCHAR(64) NOT NULL,
  business_key      VARCHAR(200) NOT NULL,
  sql_value         VARCHAR(1000),
  lakehouse_value   VARCHAR(1000),
  salesforce_value  VARCHAR(1000),
  oracle_value      VARCHAR(1000),
  drift_status      VARCHAR(20) DEFAULT 'match',
  detected_at       DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_mds_recon_tmpl ON mds.mds_reconciliation(template_key);

-- 14. PUBLISH LOG ------------------------------------------------
CREATE TABLE mds.mds_publish_log (
  publish_id   VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(64) NOT NULL,
  target       VARCHAR(20) NOT NULL,
  status       VARCHAR(20) NOT NULL,
  row_count    INT,
  sql_table    VARCHAR(128),
  bronze_table VARCHAR(128),
  batch_id     VARCHAR(64),
  submitted_by VARCHAR(80),
  submitted_at DATETIME2 DEFAULT SYSUTCDATETIME(),
  message      VARCHAR(1000)
);
CREATE INDEX ix_mds_publish_tmpl ON mds.mds_publish_log(template_key, submitted_at DESC);

-- 15. USERS ------------------------------------------------------
CREATE TABLE mds.mds_user (
  user_id         VARCHAR(64) PRIMARY KEY,
  user_name       VARCHAR(200) NOT NULL,
  role_name       VARCHAR(40) NOT NULL,
  email           VARCHAR(200),
  avatar_initials VARCHAR(4),
  active          BIT DEFAULT 1
);
GO
