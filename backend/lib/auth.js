// ───────────────────────────────────────────────────────────────────────────
// Backend auth middleware scaffold (SC-01)
//
// Demo mode: trusts user identity from the request body / headers. The
// frontend passes user_id and role_name on write endpoints — fine for a
// behind-the-firewall demo, NOT for production.
//
// To swap to Microsoft Entra ID validation:
//   npm i jose  # JWT verification
//
//   // backend/lib/auth.js
//   import { createRemoteJWKSet, jwtVerify } from "jose";
//   const TENANT_ID = process.env.AAD_TENANT_ID;
//   const AUDIENCE  = process.env.AAD_AUDIENCE;            // api://<app-id>
//   const JWKS = createRemoteJWKSet(new URL(
//     `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`));
//
//   export async function requireAuth(req, res, next) {
//     try {
//       const hdr = req.headers.authorization ?? "";
//       const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
//       if (!token) return res.status(401).json({ error: "no token" });
//       const { payload } = await jwtVerify(token, JWKS, {
//         audience: AUDIENCE,
//         issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
//       });
//       req.user = {
//         user_id: payload.preferred_username ?? payload.oid,
//         role_name: claimToRole(payload),  // map AAD groups/app-roles → MDS role
//       };
//       next();
//     } catch (e) {
//       res.status(401).json({ error: "invalid token" });
//     }
//   }
//
// Then in server.js:
//   import { requireAuth } from "./lib/auth.js";
//   app.use("/api", requireAuth);     // mount BEFORE the resource routers
//
// And replace `req.body.user` / `req.body.role` lookups with `req.user.*`.
// ───────────────────────────────────────────────────────────────────────────

export const AUTH_MODE = "demo";

// Demo middleware: pass-through. Routes still read user/role from req.body.
export function requireAuth(_req, _res, next) { next(); }