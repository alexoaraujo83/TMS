/**
 * Deterministic first-pass compatibility checks for freight and vehicle capacity.
 *
 * Vehicle dimensions and payload must come from the actual vehicle/implement data.
 * The legal-envelope values in this module are reference defaults, not a legal
 * determination; production callers should pass limits verified for the route,
 * vehicle configuration and current regulation.
 */

export const VEHICLE_BODY_TYPES = [
  "bau",
  "sider",
  "grade_baixa",
  "prancha",
  "graneleiro",
  "porta_container",
  "refrigerado",
  "basculante",
  "tanque",
  "aberto",
  "outro",
] as const;

export type VehicleBodyType = (typeof VEHICLE_BODY_TYPES)[number];

export const LOGISTICS_OPERATION_TYPES = [
  "transferencia",
  "distribuicao",
  "lotacao",
  "fracionado",
  "cross_docking",
  "milk_run",
] as const;

export type LogisticsOperationType =
  (typeof LOGISTICS_OPERATION_TYPES)[number];

export const CARGO_PROFILES = [
  "ecommerce",
  "carga_fracionada",
  "tubos_estruturas",
  "maquinas",
  "container_iso_20",
  "container_iso_40",
  "carga_pesada",
  "pereciveis",
  "carga_alta",
  "graos",
  "liquidos_quimicos",
  "carga_geral",
] as const;

export type CargoProfile = (typeof CARGO_PROFILES)[number];

export interface VehicleReference {
  code: string;
  label: string;
  recommendedVehicleTypes: readonly string[];
  recommendedBodyTypes: readonly VehicleBodyType[];
  notes: readonly string[];
}

export const VEHICLE_BODY_CATALOG: readonly VehicleReference[] = [
  { code: "bau", label: "Baú", recommendedVehicleTypes: [], recommendedBodyTypes: ["bau"], notes: ["Proteção contra clima e exposição da carga"] },
  { code: "sider", label: "Sider", recommendedVehicleTypes: [], recommendedBodyTypes: ["sider"], notes: ["Acesso lateral; útil para pallets"] },
  { code: "grade_baixa", label: "Grade baixa", recommendedVehicleTypes: [], recommendedBodyTypes: ["grade_baixa"], notes: ["Tubos, estruturas metálicas e máquinas; exige amarração adequada"] },
  { code: "prancha", label: "Prancha", recommendedVehicleTypes: [], recommendedBodyTypes: ["prancha"], notes: ["Máquinas pesadas e cargas indivisíveis; avaliar autorização e rota"] },
  { code: "graneleiro", label: "Graneleiro", recommendedVehicleTypes: [], recommendedBodyTypes: ["graneleiro"], notes: ["Grãos e commodities agrícolas"] },
  { code: "porta_container", label: "Porta-container", recommendedVehicleTypes: [], recommendedBodyTypes: ["porta_container"], notes: ["Conferir padrão ISO, comprimento e travamento"] },
  { code: "refrigerado", label: "Refrigerado", recommendedVehicleTypes: [], recommendedBodyTypes: ["refrigerado"], notes: ["Definir e monitorar a faixa de temperatura exigida"] },
  { code: "basculante", label: "Basculante", recommendedVehicleTypes: [], recommendedBodyTypes: ["basculante"], notes: ["Areia, pedra, terra e cargas a granel compatíveis"] },
  { code: "tanque", label: "Tanque", recommendedVehicleTypes: [], recommendedBodyTypes: ["tanque"], notes: ["Validar produto, compartimentos, limpeza e requisitos específicos"] },
] as const;

export interface CargoDimensionsM {
  lengthM?: number;
  widthM?: number;
  heightM?: number;
}

export interface VehicleDimensionsM {
  internalLengthM?: number;
  internalWidthM?: number;
  internalHeightM?: number;
}

export interface LegalEnvelopeReference {
  /** Reference only; verify current law and applicability before blocking a shipment. */
  maximumOverallHeightM?: number;
  maximumOverallWidthM?: number;
  maximumOverallLengthM?: number;
  requiresLegalReviewAboveHeight?: boolean;
}

export interface VehicleCompatibilityInput {
  cargoProfile: CargoProfile;
  cargoWeightKg: number;
  cargoDimensions?: CargoDimensionsM;
  declaredVolumeM3?: number;
  volumetricFactorKgM3?: number;
  requiredBodyTypes?: readonly VehicleBodyType[];
  vehicleType: string;
  vehicleBodyType: VehicleBodyType;
  payloadCapacityKg: number;
  vehicleDimensions?: VehicleDimensionsM;
  /** Total height of loaded vehicle, not cargo height alone. */
  loadedOverallHeightM?: number;
  loadedOverallWidthM?: number;
  loadedOverallLengthM?: number;
  axleStatus?: "within_limit" | "exceeded" | "unknown";
  legalEnvelope?: LegalEnvelopeReference;
}

export type CompatibilityStatus = "approved" | "pending" | "rejected";

export interface VehicleCompatibilityResult {
  status: CompatibilityStatus;
  reasons: readonly string[];
  volumeM3: number | null;
  cubedWeightKg: number | null;
  volumetricFactorKgM3: number | null;
  recommendedBodyTypes: readonly VehicleBodyType[];
}

const PROFILE_RULES: Record<
  CargoProfile,
  { bodies: readonly VehicleBodyType[]; vehicleTypes?: readonly string[]; notes: readonly string[] }
> = {
  ecommerce: { bodies: ["bau"], vehicleTypes: ["fiorino", "vuc"], notes: ["Confirmar restrições de acesso e entrega urbana"] },
  carga_fracionada: { bodies: ["bau", "sider"], notes: ["Conferir segregação, unitização e sequência de entrega"] },
  tubos_estruturas: { bodies: ["grade_baixa", "prancha", "aberto"], notes: ["Validar pontos de apoio, amarração e balanços"] },
  maquinas: { bodies: ["prancha", "grade_baixa"], notes: ["Conferir peso concentrado, pontos de fixação e meios de carga"] },
  container_iso_20: { bodies: ["porta_container"], notes: ["Conferir dimensões ISO, travas e peso bruto do conjunto"] },
  container_iso_40: { bodies: ["porta_container"], notes: ["Conferir dimensões ISO, travas e peso bruto do conjunto"] },
  carga_pesada: { bodies: ["prancha", "aberto"], vehicleTypes: ["carreta", "ls", "vanderleia", "bitrem", "rodotrem"], notes: ["Exige análise de distribuição de peso e carga por eixo"] },
  pereciveis: { bodies: ["refrigerado"], notes: ["Registrar faixa térmica, setpoint e evidência de monitoramento"] },
  carga_alta: { bodies: ["prancha", "aberto"], notes: ["Medir altura total carregada e avaliar rota/autorização"] },
  graos: { bodies: ["graneleiro", "basculante"], notes: ["Confirmar produto e compatibilidade com descarga"] },
  liquidos_quimicos: { bodies: ["tanque"], notes: ["Validar classificação do produto e requisitos específicos aplicáveis"] },
  carga_geral: { bodies: ["bau", "sider", "aberto"], notes: ["Selecionar carroceria conforme acondicionamento e proteção exigida"] },
};

function positiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function validateOptionalMeasurement(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

function calculateVolume(dimensions?: CargoDimensionsM): number | null {
  if (!dimensions) return null;
  const values = [dimensions.lengthM, dimensions.widthM, dimensions.heightM];
  if (values.every((value) => value === undefined)) return null;
  if (!values.every(positiveFinite)) return null;
  return Number((values[0]! * values[1]! * values[2]!).toFixed(6));
}

export function getCargoProfileRecommendations(
  profile: CargoProfile,
): { vehicleTypes: readonly string[]; bodyTypes: readonly VehicleBodyType[]; notes: readonly string[] } {
  const rule = PROFILE_RULES[profile];
  return {
    vehicleTypes: rule.vehicleTypes ?? [],
    bodyTypes: rule.bodies,
    notes: rule.notes,
  };
}

export function validateVehicleCompatibility(
  input: VehicleCompatibilityInput,
): VehicleCompatibilityResult {
  validateOptionalMeasurement(input.cargoWeightKg, "cargoWeightKg");
  validateOptionalMeasurement(input.payloadCapacityKg, "payloadCapacityKg");
  validateOptionalMeasurement(input.declaredVolumeM3, "declaredVolumeM3");
  validateOptionalMeasurement(input.volumetricFactorKgM3, "volumetricFactorKgM3");

  const profile = PROFILE_RULES[input.cargoProfile];
  if (!profile) throw new Error("Unknown cargo profile");

  const reasons: string[] = [];
  const recommendedBodyTypes = profile.bodies;
  let status: CompatibilityStatus = "approved";
  const setStatus = (next: CompatibilityStatus) => {
    if (next === "rejected" || (next === "pending" && status === "approved")) status = next;
  };

  if (!recommendedBodyTypes.includes(input.vehicleBodyType)) {
    reasons.push("body-type-incompatible");
    setStatus("rejected");
  }

  if (profile.vehicleTypes?.length && !profile.vehicleTypes.includes(input.vehicleType)) {
    reasons.push("vehicle-type-needs-manual-review");
    setStatus("pending");
  }

  if (input.requiredBodyTypes?.length && !input.requiredBodyTypes.includes(input.vehicleBodyType)) {
    reasons.push("freight-required-body-type-not-met");
    setStatus("rejected");
  }

  if (input.cargoWeightKg > input.payloadCapacityKg) {
    reasons.push("cargo-weight-exceeds-payload");
    setStatus("rejected");
  }

  const volumeM3 = calculateVolume(input.cargoDimensions) ?? input.declaredVolumeM3 ?? null;
  const hasAnyDimension = input.cargoDimensions
    ? [input.cargoDimensions.lengthM, input.cargoDimensions.widthM, input.cargoDimensions.heightM].some((value) => value !== undefined)
    : false;
  const hasCompleteDimensions = Boolean(
    input.cargoDimensions &&
    positiveFinite(input.cargoDimensions.lengthM) &&
    positiveFinite(input.cargoDimensions.widthM) &&
    positiveFinite(input.cargoDimensions.heightM),
  );

  if (hasAnyDimension && !hasCompleteDimensions) {
    reasons.push("cargo-dimensions-incomplete");
    setStatus("pending");
  }

  if (hasCompleteDimensions) {
    const cargo = input.cargoDimensions!;
    const vehicle = input.vehicleDimensions;
    const comparisons: [number | undefined, number | undefined, string][] = [
      [cargo.lengthM, vehicle?.internalLengthM, "cargo-length-exceeds-vehicle"],
      [cargo.widthM, vehicle?.internalWidthM, "cargo-width-exceeds-vehicle"],
      [cargo.heightM, vehicle?.internalHeightM, "cargo-height-exceeds-vehicle"],
    ];
    for (const [cargoMeasure, vehicleMeasure, reason] of comparisons) {
      if (!positiveFinite(vehicleMeasure)) {
        reasons.push("vehicle-internal-dimensions-unverified");
        setStatus("pending");
        break;
      }
      if (cargoMeasure! > vehicleMeasure) {
        reasons.push(reason);
        setStatus("rejected");
      }
    }
  }

  const factor = input.volumetricFactorKgM3 ?? null;
  const cubedWeightKg = volumeM3 !== null && factor !== null
    ? Number((volumeM3 * factor).toFixed(2))
    : null;

  if (input.axleStatus === "exceeded") {
    reasons.push("axle-load-exceeded-redistribution-required");
    setStatus("pending");
  } else if (input.axleStatus === "unknown") {
    reasons.push("axle-load-not-verified");
    setStatus("pending");
  }

  const envelope = input.legalEnvelope;
  if (envelope?.maximumOverallHeightM && input.loadedOverallHeightM !== undefined &&
      input.loadedOverallHeightM > envelope.maximumOverallHeightM) {
    reasons.push(envelope.requiresLegalReviewAboveHeight
      ? "loaded-height-exceeds-reference-review-limit"
      : "loaded-height-exceeds-configured-limit");
    setStatus("pending");
  }
  if (envelope?.maximumOverallWidthM && input.loadedOverallWidthM !== undefined &&
      input.loadedOverallWidthM > envelope.maximumOverallWidthM) {
    reasons.push("loaded-width-exceeds-reference-review-limit");
    setStatus("pending");
  }
  if (envelope?.maximumOverallLengthM && input.loadedOverallLengthM !== undefined &&
      input.loadedOverallLengthM > envelope.maximumOverallLengthM) {
    reasons.push("loaded-length-exceeds-reference-review-limit");
    setStatus("pending");
  }

  if (volumeM3 === null) reasons.push("volume-not-calculated");
  if (factor === null) reasons.push("volumetric-factor-not-configured");
  if (input.axleStatus === undefined) reasons.push("axle-load-data-not-provided");

  if (reasons.length === 0) reasons.push("physical-checks-passed");

  return {
    status,
    reasons: [...new Set(reasons)],
    volumeM3,
    cubedWeightKg,
    volumetricFactorKgM3: factor,
    recommendedBodyTypes,
  };
}
