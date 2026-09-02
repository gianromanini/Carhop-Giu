export type DiscountProgram = {
  minDays: number;
  percent: number;
};

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

export function calculateVehicleDiscount(vehicle: any, days: number) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 1));
  const dailyRate = Math.max(0, Number(vehicle?.price) || 0);
  const grossRental = dailyRate * safeDays;
  const program = normalizeDiscountPrograms(vehicle?.pricing?.discountPrograms)
    .find((candidate) => safeDays > candidate.minDays);
  const discountPercent = program?.percent || 0;
  const discountAmount = grossRental * (discountPercent / 100);

  return {
    grossRental,
    discountAmount,
    discountPercent,
    netRental: grossRental - discountAmount,
  };
}