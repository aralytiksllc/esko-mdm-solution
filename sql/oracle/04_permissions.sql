-- Per-object RBAC (SC-02): allow-list of (template, role, action) triples.
CREATE TABLE mds_template_permission (
  template_key VARCHAR2(64) NOT NULL,
  role_name    VARCHAR2(40) NOT NULL,
  action       VARCHAR2(20) NOT NULL,
  CONSTRAINT pk_mds_template_permission PRIMARY KEY (template_key, role_name, action),
  CONSTRAINT fk_mds_template_permission FOREIGN KEY (template_key) REFERENCES mds_template(template_key) ON DELETE CASCADE,
  CONSTRAINT ck_mds_perm_action CHECK (action IN ('view','edit','submit','approve','admin'))
);

CREATE INDEX ix_mds_perm_lookup ON mds_template_permission(template_key, role_name);