-- Provisioning queue: every schema change emits a DDL bundle pending steward deployment.
CREATE TABLE mds_provisioning (
  prov_id           VARCHAR2(50)  NOT NULL,
  template_key      VARCHAR2(64)  NOT NULL,
  target            VARCHAR2(20)  NOT NULL,
  ddl_kind          VARCHAR2(20)  NOT NULL,
  column_name       VARCHAR2(128),
  ddl_text          CLOB          NOT NULL,
  status            VARCHAR2(20)  DEFAULT 'pending' NOT NULL,
  generated_at      TIMESTAMP     DEFAULT SYSTIMESTAMP,
  generated_by      VARCHAR2(50),
  deployed_at       TIMESTAMP,
  deployed_by       VARCHAR2(50),
  deployed_comment  VARCHAR2(500),
  CONSTRAINT pk_mds_provisioning PRIMARY KEY (prov_id),
  CONSTRAINT ck_mds_prov_target CHECK (target IN ('sql','lakehouse')),
  CONSTRAINT ck_mds_prov_status CHECK (status IN ('pending','deployed','rejected','superseded'))
);

CREATE INDEX ix_mds_prov_status ON mds_provisioning(template_key, target, status);