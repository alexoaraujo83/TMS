# TMS — Vehicle and cargo compatibility

## Scope

The initial reusable rule module lives in `packages/matching/src/vehicle-compatibility.ts`. It is a domain library, not yet a production API endpoint or a persisted vehicle catalog.

## Body types in the reference catalog

Baú, Sider, grade baixa, prancha, graneleiro, porta-container, refrigerado, basculante and tanque are represented explicitly. Existing generic body types remain supported by the existing freight domain; do not migrate persisted values without a separate compatibility review.

## Cargo profile recommendations

| Cargo profile | Suggested body / vehicle | Mandatory follow-up |
| --- | --- | --- |
| E-commerce | Fiorino / VUC; baú as a body recommendation | Validate access and urban restrictions |
| Fracionada | Baú / Sider | Validate handling and delivery sequence |
| Tubos/estruturas | Grade baixa / prancha / aberto | Validate supports, restraints and overhang |
| Máquinas | Prancha / grade baixa | Validate concentrated load and loading equipment |
| Container ISO 20/40 | Porta-container | Validate actual ISO dimensions, locks and gross weight |
| Carga pesada | Carreta/LS/Vanderleia/Bitrem/Rodotrem candidates | Validate axle distribution and route |
| Perecíveis | Refrigerado | Record required temperature range and monitoring |
| Carga alta | Prancha / aberto | Measure total loaded height and verify route/legal envelope |
| Grãos | Graneleiro / basculante | Confirm material and discharge method |
| Líquidos/químicos | Tanque | Validate product classification and applicable requirements |

Recommendations are screening rules, not a guarantee that a particular vehicle or route is legally suitable.

## Calculations

- Cubic volume: `lengthM × widthM × heightM`, with all dimensions in metres.
- Volumetric weight: `volumeM3 × volumetricFactorKgM3`.
- The volumetric factor is explicitly supplied by the caller. Rodoviário 300 kg/m³, aéreo 166.7 kg/m³ and express 250–300 kg/m³ are reference examples from the supplied material, not universal defaults.
- The supplied example 2.20 × 2.50 × 2.00 m = 11 m³; at 300 kg/m³ the volumetric weight is 3,300 kg.

## Status semantics

- `approved`: checks implemented for supplied data passed. This does not certify legal compliance.
- `pending`: key dimensions/capacity/legal/axle facts are absent, incomplete, unverified or require expert review.
- `rejected`: confirmed body mismatch, dimension exceedance against actual internal measurements, a freight-required body mismatch, or cargo weight above the vehicle's stated payload.

When actual vehicle internal dimensions are missing, a cargo with dimensions is pending rather than assumed to fit. Axle overload is pending for redistribution and reassessment. Configured legal-envelope exceedances create a review reason; they do not automatically declare an AET mandatory.

## Regulatory source discipline

The supplied notes cite CONTRAN Resolution 882/2021, DNIT and ANTT/RNTRC. Before production blocking rules are enabled, verify the currently effective official text, amendments, vehicle configuration, route and applicable permits. Do not treat manual reference dimensions as a legal oracle.

## Test coverage

The package tests cubage, configured factor, dimension and payload failures, missing measurements, axle uncertainty, configured envelope review, cargo/body recommendations and invalid numeric input.

## Next integration gates

1. Review DTOs and API validation before exposing new body types.
2. Add tenant-scoped actual dimensions, axle data and required equipment only through a forward-only migration if existing schema cannot represent them.
3. Integrate hard eligibility checks before ranking candidates; do not let a high commercial score override a physical or compliance failure.
4. Add API, cross-tenant negative, UI and deployed-runtime evidence before claiming operational availability.
