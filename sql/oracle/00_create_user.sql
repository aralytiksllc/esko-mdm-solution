-- =============================================================
-- Run as SYS AS SYSDBA (or any DBA user)
-- Creates the MDS schema for the demo
-- =============================================================
-- Replace change-me before running in a non-local demo environment.
CREATE USER MDS IDENTIFIED BY "change-me";
GRANT CONNECT, RESOURCE TO MDS;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE,
      CREATE PROCEDURE, CREATE TRIGGER, CREATE SYNONYM, CREATE TYPE
      TO MDS;
ALTER USER MDS QUOTA UNLIMITED ON USERS;
