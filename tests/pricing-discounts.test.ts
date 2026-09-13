import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateVehicleDiscount } from '../shared/pricing.ts';

const vehicle = {
  price: 47,
  pricing: {
    discountPrograms: [
      { minDays: 3, percent: 5 },
      { minDays: 5, percent: 10 },
      { minDays: 7, percent: 15 },
      { minDays: 15, percent: 20 },
    ],
  },
};

test('progressive discount respects the configured more-than thresholds', () => {
  assert.equal(calculateVehicleDiscount(vehicle, 7, 47).discountPercent, 10);
  assert.equal(calculateVehicleDiscount(vehicle, 8, 47).discountPercent, 15);
  assert.equal(calculateVehicleDiscount(vehicle, 16, 47).discountPercent, 20);
});

test('extension discount is calculated only from the added days', () => {
  const extension = calculateVehicleDiscount(vehicle, 7, 47);

  assert.equal(extension.grossRental, 329);
  assert.equal(extension.discountAmount, 32.9);
  assert.equal(extension.netRental, 296.1);
});