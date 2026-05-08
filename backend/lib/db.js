import oracledb from "oracledb";

oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

export async function initPool() {
  if (pool) return pool;
  pool = await oracledb.createPool({
    user: process.env.MDS_DB_USER,
    password: process.env.MDS_DB_PASSWORD,
    connectString: process.env.MDS_DB_CONNECT_STRING,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1,
  });
  console.log(`[db] pool up → ${process.env.MDS_DB_USER}@${process.env.MDS_DB_CONNECT_STRING}`);
  return pool;
}

export async function query(sql, binds = {}, opts = {}) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, { autoCommit: true, ...opts });
    return result;
  } finally {
    await conn.close();
  }
}

export async function closePool() {
  if (pool) await pool.close(0);
}

// Lowercase keys and parse JSON columns transparently
export function normalizeRows(rows, jsonCols = []) {
  return rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      const key = k.toLowerCase();
      if (jsonCols.includes(key) && typeof v === "string" && v.length) {
        try { out[key] = JSON.parse(v); } catch { out[key] = v; }
      } else {
        out[key] = v;
      }
    }
    return out;
  });
}
