// DDL generators for SQL Server target + Fabric Lakehouse Bronze (Delta).
// Pure functions — no DB calls, no side effects.

const SQL_TYPE = {
  text:   "NVARCHAR(255)",
  number: "DECIMAL(18,6)",
  date:   "DATE",
  select: "NVARCHAR(50)",
};
const DELTA_TYPE = {
  text:   "STRING",
  number: "DOUBLE",
  date:   "DATE",
  select: "STRING",
};

const AUDIT_SQL = [
  ["modified_by", "NVARCHAR(50)"],
  ["modified_at", "DATETIME2 DEFAULT SYSUTCDATETIME()"],
  ["batch_id",    "NVARCHAR(40)"],
  ["action_type", "NVARCHAR(20)"],
];
const AUDIT_DELTA = [
  ["modified_by", "STRING"],
  ["modified_at", "TIMESTAMP"],
  ["batch_id",    "STRING"],
  ["action_type", "STRING"],
];

// "Group Code" → "group_code"  · "Org Code" → "org_code"
function toIdent(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeStr(v) {
  return String(v).replace(/'/g, "''");
}

function colDefSql(c) {
  const ident = toIdent(c.name);
  const type = SQL_TYPE[c.type] ?? SQL_TYPE.text;
  let line = `  ${ident.padEnd(14)} ${type.padEnd(15)} ${c.required ? "NOT NULL" : "NULL    "}`;
  if (c.type === "select" && Array.isArray(c.options) && c.options.length) {
    const list = c.options.map(o => `'${escapeStr(o)}'`).join(",");
    line += ` CHECK (${ident} IN (${list})${c.required ? "" : ` OR ${ident} IS NULL`})`;
  }
  return line;
}

function colDefDelta(c) {
  const ident = toIdent(c.name);
  const type = DELTA_TYPE[c.type] ?? DELTA_TYPE.text;
  return `  ${ident.padEnd(14)} ${type}`;
}

// ── CREATE TABLE ──
export function ddlCreateTableSql(template, columns) {
  const sqlTable = template.sql_table || `mds.${template.template_key}`;
  const keyCol = columns.find(c => c.isKey) ?? columns[0];
  const keyIdent = keyCol ? toIdent(keyCol.name) : null;

  const cols = [
    ...columns.map(colDefSql),
    ...AUDIT_SQL.map(([n, t]) => `  ${n.padEnd(14)} ${t}`),
  ].join(",\n");

  const pk = keyIdent
    ? `,\n  CONSTRAINT pk_${sqlTable.replace(/\./g, "_")} PRIMARY KEY (${keyIdent})`
    : "";

  return [
    `-- ── SQL Server target ──`,
    `CREATE TABLE ${sqlTable} (`,
    cols + pk,
    `);`,
    `GRANT SELECT ON ${sqlTable} TO mds_consumer_role;`,
  ].join("\n");
}

export function ddlCreateTableDelta(template, columns) {
  const bronze = template.bronze_table || `brz_mds_${template.template_key}`;
  const cols = [
    ...columns.map(colDefDelta),
    ...AUDIT_DELTA.map(([n, t]) => `  ${n.padEnd(14)} ${t}`),
  ].join(",\n");

  return [
    `-- ── Fabric Lakehouse Bronze (Delta) ──`,
    `CREATE TABLE ${bronze} (`,
    cols,
    `) USING DELTA`,
    `  LOCATION 'Files/bronze/mds/${template.template_key}'`,
    `  TBLPROPERTIES ('delta.columnMapping.mode' = 'name');`,
  ].join("\n");
}

// ── ALTER TABLE ADD COLUMN ──
export function ddlAddColumnSql(template, column) {
  const sqlTable = template.sql_table || `mds.${template.template_key}`;
  const ident = toIdent(column.name);
  const type = SQL_TYPE[column.type] ?? SQL_TYPE.text;
  let line = `ALTER TABLE ${sqlTable} ADD ${ident} ${type} ${column.required ? "NOT NULL" : "NULL"}`;
  if (column.type === "select" && Array.isArray(column.options) && column.options.length) {
    const list = column.options.map(o => `'${escapeStr(o)}'`).join(",");
    line += ` CHECK (${ident} IN (${list})${column.required ? "" : ` OR ${ident} IS NULL`})`;
  }
  return [`-- ── SQL Server target ──`, line + ";"].join("\n");
}

export function ddlAddColumnDelta(template, column) {
  const bronze = template.bronze_table || `brz_mds_${template.template_key}`;
  const ident = toIdent(column.name);
  const type = DELTA_TYPE[column.type] ?? DELTA_TYPE.text;
  return [
    `-- ── Fabric Lakehouse Bronze (Delta) ──`,
    `ALTER TABLE ${bronze} ADD COLUMNS (${ident} ${type});`,
  ].join("\n");
}

// ── ALTER TABLE DROP COLUMN ──
export function ddlDropColumnSql(template, columnName) {
  const sqlTable = template.sql_table || `mds.${template.template_key}`;
  return [
    `-- ── SQL Server target ──`,
    `ALTER TABLE ${sqlTable} DROP COLUMN ${toIdent(columnName)};`,
  ].join("\n");
}

export function ddlDropColumnDelta(template, columnName) {
  const bronze = template.bronze_table || `brz_mds_${template.template_key}`;
  return [
    `-- ── Fabric Lakehouse Bronze (Delta) ──`,
    `ALTER TABLE ${bronze} DROP COLUMN ${toIdent(columnName)};`,
  ].join("\n");
}

// ── DROP TABLE ──
export function ddlDropTableSql(template) {
  const sqlTable = template.sql_table || `mds.${template.template_key}`;
  return [
    `-- ── SQL Server target ──`,
    `DROP TABLE ${sqlTable};`,
  ].join("\n");
}

export function ddlDropTableDelta(template) {
  const bronze = template.bronze_table || `brz_mds_${template.template_key}`;
  return [
    `-- ── Fabric Lakehouse Bronze (Delta) ──`,
    `DROP TABLE ${bronze};`,
  ].join("\n");
}