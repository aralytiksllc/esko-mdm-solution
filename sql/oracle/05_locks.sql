-- Concurrency locking (SC-03): one editing lock per template at a time.
CREATE TABLE mds_template_lock (
  template_key   VARCHAR2(64) NOT NULL,
  locked_by      VARCHAR2(80) NOT NULL,
  locked_by_name VARCHAR2(120),
  locked_at      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  expires_at     TIMESTAMP NOT NULL,
  CONSTRAINT pk_mds_template_lock PRIMARY KEY (template_key),
  CONSTRAINT fk_mds_template_lock FOREIGN KEY (template_key) REFERENCES mds_template(template_key) ON DELETE CASCADE
);