// ───────────────────────────────────────────────────────────────────────────
// SSO scaffold (SC-01)
//
// In the demo, identity is stubbed: the user picker in the Header chooses one
// of the seeded `mds_user` rows and that becomes `currentUser`. For
// production, swap this file's exports for a real Microsoft Entra ID flow:
//
//   1. Install @azure/msal-react and @azure/msal-browser
//      npm i @azure/msal-react @azure/msal-browser
//
//   2. Wrap the app:
//
//        // src/main.jsx
//        import { PublicClientApplication } from "@azure/msal-browser";
//        import { MsalProvider } from "@azure/msal-react";
//
//        const msalInstance = new PublicClientApplication({
//          auth: {
//            clientId: import.meta.env.VITE_AAD_CLIENT_ID,
//            authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,
//            redirectUri: window.location.origin,
//          },
//          cache: { cacheLocation: "sessionStorage" },
//        });
//
//        ReactDOM.createRoot(...).render(
//          <MsalProvider instance={msalInstance}>
//            <MDSApp />
//          </MsalProvider>
//        );
//
//   3. Replace the body of useCurrentUser() with:
//
//        import { useMsal, useIsAuthenticated } from "@azure/msal-react";
//        import { InteractionType } from "@azure/msal-browser";
//        export function useCurrentUser() {
//          const { accounts, instance } = useMsal();
//          const account = accounts[0];
//          if (!account) return null;
//          // Map the AAD claim to your app's role via group membership or app role.
//          return {
//            user_id: account.username,
//            user_name: account.name,
//            role_name: claimToRole(account.idTokenClaims),
//            avatar_initials: initials(account.name),
//          };
//        }
//
//   4. On every fetch, attach the bearer token (api.js):
//
//        const tokenResp = await msalInstance.acquireTokenSilent({
//          account: accounts[0], scopes: ["api://<api-app-id>/.default"],
//        });
//        headers.Authorization = `Bearer ${tokenResp.accessToken}`;
//
//   5. Backend validates the token (see backend/lib/auth.js).
// ───────────────────────────────────────────────────────────────────────────

export const AUTH_MODE = "demo"; // "demo" | "entra-id"

// In demo mode the Header user-picker is the source of truth.
// In production, the MsalProvider wrapping the app supplies the account.
export function isDemoAuth() {
  return AUTH_MODE === "demo";
}

// Demo helper to map a stubbed user object to the app's user shape.
// Replace with a real claim → role mapping in production (group / app role).
export function normalizeStubUser(u) {
  if (!u) return null;
  return {
    user_id: u.user_id,
    user_name: u.user_name,
    role_name: u.role_name,
    avatar_initials: u.avatar_initials ?? (u.user_name || "?").slice(0, 2).toUpperCase(),
  };
}