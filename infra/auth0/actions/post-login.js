/**
 * TMS — Auth0 Post Login Action
 *
 * Auth0 remains the Identity Provider. Tenant membership, roles and permissions
 * remain authoritative in TMS/PostgreSQL and are re-checked by the API.
 *
 * Configure this Action in the Auth0 Login Flow for each environment.
 */

const CLAIM_NAMESPACE = "https://tms-platform.io/claims";
const TENANT_ID_CLAIM = `${CLAIM_NAMESPACE}/tenant_id`;
const EMAIL_CLAIM = `${CLAIM_NAMESPACE}/email`;
const DISPLAY_NAME_CLAIM = `${CLAIM_NAMESPACE}/display_name`;

exports.onExecutePostLogin = async (event, api) => {
  const tenantId = event.user?.app_metadata?.tenant_id;

  if (typeof tenantId === "string" && tenantId.trim().length > 0) {
    const normalizedTenantId = tenantId.trim();
    api.accessToken.setCustomClaim(TENANT_ID_CLAIM, normalizedTenantId);
    api.idToken.setCustomClaim(TENANT_ID_CLAIM, normalizedTenantId);
  }

  if (typeof event.user?.email === "string" && event.user.email.trim().length > 0) {
    const email = event.user.email.trim();
    api.accessToken.setCustomClaim(EMAIL_CLAIM, email);
    api.idToken.setCustomClaim(EMAIL_CLAIM, email);
  }

  const displayName =
    typeof event.user?.name === "string" && event.user.name.trim().length > 0
      ? event.user.name.trim()
      : typeof event.user?.nickname === "string" && event.user.nickname.trim().length > 0
        ? event.user.nickname.trim()
        : typeof event.user?.email === "string"
          ? event.user.email.trim()
          : undefined;

  if (displayName) {
    api.accessToken.setCustomClaim(DISPLAY_NAME_CLAIM, displayName);
    api.idToken.setCustomClaim(DISPLAY_NAME_CLAIM, displayName);
  }
};
