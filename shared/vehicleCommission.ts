export const HOST_COMMISSION_PLANS = [
  { hostShare: 70, platformCommission: 30, deductible: 250 },
  { hostShare: 75, platformCommission: 25, deductible: 500 },
  { hostShare: 80, platformCommission: 20, deductible: 1200 },
  { hostShare: 90, platformCommission: 10, deductible: 2250 },
] as const;

// Kept only so vehicles created under the previous plan can still be edited
// without silently changing their existing economics.
export const LEGACY_PLATFORM_COMMISSION = 15 as const;
export const LEGACY_VEHICLE_DEDUCTIBLE = 1250 as const;

export const VEHICLE_COMMISSION_OPTIONS = HOST_COMMISSION_PLANS.map(
  (plan) => plan.platformCommission,
);

export const VEHICLE_DEDUCTIBLES: Record<number, number> = {
  ...Object.fromEntries(
    HOST_COMMISSION_PLANS.map((plan) => [plan.platformCommission, plan.deductible]),
  ),
  [LEGACY_PLATFORM_COMMISSION]: LEGACY_VEHICLE_DEDUCTIBLE,
};

export function isAllowedVehicleCommission(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    (VEHICLE_COMMISSION_OPTIONS as readonly number[]).includes(value);
}