/**
 * Nexora TMS — Auth0 Post Login Action
 *
 * Auth0 remains the Identity Provider. Tenant membership, roles and permissions
 * remain authoritative in Nexora/PostgreSQL and are re-checked by the API.
 *
 * Configure this Action in the Auth0 Login Flow for each environment.
 */

const CLAIM_NAMESPACE = "https://nexora.tms/claims";
const TENANT_ID_CLAIM = `${CLAIM_NAMESPACE}/tenant_id`;

exports.onExecutePostLogin = async (event, api) => {
  // app_metadata is optional. Missing tenant metadata must not block login:
  // the Nexora API resolves/validates the active tenant membership itself.
  const tenantId = event.user?.app_metadata?.tenant_id;

  if (typeof tenantId === "string" && tenantId.length > 0) {
    api.accessToken.setCustomClaim(TENANT_ID_CLAIM, tenantId);
    api.idToken.setCustomClaim(TENANT_ID_CLAIM, tenantId);
  }
};
