/**
 * TMS — Auth0 Post Login Action
 *
 * Auth0 remains the Identity Provider. Tenant membership, roles and permissions
 * remain authoritative in TMS/PostgreSQL and are re-checked by the API.
 *
 * Configure this Action in the Auth0 Login Flow for each environment.
 */

const CLAIM_NAMESPACE = "https://tms.tms/claims";
const TENANT_ID_CLAIM = `${CLAIM_NAMESPACE}/tenant_id`;

exports.onExecutePostLogin = async (event, api) => {
  // app_metadata is the current token-issuance bridge to the authoritative
  // TMS tenant UUID. Login itself is not blocked when it is missing, but the
  // TMS API requires this claim for protected tenant-scoped requests.
  const tenantId = event.user?.app_metadata?.tenant_id;

  if (typeof tenantId === "string" && tenantId.trim().length > 0) {
    const normalizedTenantId = tenantId.trim();
    api.accessToken.setCustomClaim(TENANT_ID_CLAIM, normalizedTenantId);
    api.idToken.setCustomClaim(TENANT_ID_CLAIM, normalizedTenantId);
  }
};
