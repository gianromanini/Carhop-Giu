export type DiscountProgram = {
  minDays: number;
  percent: number;
};

export const DEFAULT_WEEKLY_DISCOUNT_PROGRAMS: DiscountProgram[] = [
  { minDays: 21, percent: 20 },
  { minDays: 8, percent: 15 },
  { minDays: 7, percent: 10 },
];

export function normalizeDiscountPrograms(value: unknown): DiscountProgram[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((program) => ({
      minDays: Math.max(1, Math.floor(Number((program as any)?.minDays) || 0)),
      percent: Math.min(100, Math.max(0, Number((program as any)?.percent) || 0)),
    }))
    .filter((program) => program.minDays > 0 && program.percent > 0)
    .sort((a, b) => b.minDays - a.minDays);
}

export function calculateVehicleDiscount(vehicle: any, days: number, dailyRateOverride?: number) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 1));
  const overrideRate = Number(dailyRateOverride);
  const dailyRate = Math.max(
    0,
    Number.isFinite(overrideRate) && overrideRate > 0 ? overrideRate : Number(vehicle?.price) || 0,
  );
  const grossRental = dailyRate * safeDays;
  const configuredPrograms = normalizeDiscountPrograms(vehicle?.pricing?.discountPrograms);
  const program = configuredPrograms.length > 0
    ? configuredPrograms.find((candidate) => safeDays > candidate.minDays)
    : DEFAULT_WEEKLY_DISCOUNT_PROGRAMS.find((candidate) => safeDays >= candidate.minDays);
  const discountPercent = program?.percent || 0;
  const discountAmount = grossRental * (discountPercent / 100);

  return {
    grossRental,
    discountAmount,
    discountPercent,
    netRental: grossRental - discountAmount,
  };
}