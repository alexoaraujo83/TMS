# TMS Auth0 Tenant Claim Manager

Automates the TMS Post Login Action lifecycle: locate/create, update, deploy, bind, and verify.

Claim source: `event.user.app_metadata.tenant_id`

Claim: `https://tms-platform.io/claims/tenant_id`

Required GitHub Actions production-environment secret: `AUTH0_MGMT_TOKEN`

The Management API token must never be committed to the repository. The workflow is manual by design.

After a successful run, validate the real TMS Web login and the real TMS API Access Token separately. A Management API token is not a TMS API Access Token.
