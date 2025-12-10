/**
 * Stripe Product Seed Script for CarHop
 * 
 * Usage: npx tsx server/seed-stripe-products.ts
 * 
 * This script creates products and prices in your Stripe account
 * All products are created with metadata for easy identification
 */

import Stripe from 'stripe';

// Get Stripe secret key from environment
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-08-27.basil',
});

async function createCarRentalProducts() {
  console.log('Creating CarHop Stripe products...\n');

  // 1. Daily Rental Rate Product
  console.log('📦 Creating Daily Rental Rate product...');
  const dailyRentalProduct = await stripe.products.create({
    name: 'Daily Car Rental',
    description: 'Daily rate for car rental (per 24 hours)',
    metadata: {
      category: 'rental',
      type: 'daily_rate',
      carhop_id: 'daily_rental',
    },
  });
  console.log(`✅ Product created: ${dailyRentalProduct.id}\n`);

  // Create price for daily rental
  const dailyRentalPrice = await stripe.prices.create({
    product: dailyRentalProduct.id,
    unit_amount: 5000, // $50.00 per day (in cents)
    currency: 'usd',
    metadata: {
      rate_per_day: '50',
      vehicle_category: 'economy',
    },
  });
  console.log(`✅ Daily rental price created: ${dailyRentalPrice.id}`);
  console.log(`   Price: $${(dailyRentalPrice.unit_amount! / 100).toFixed(2)}/day\n`);

  // 2. Insurance Product
  console.log('📦 Creating Insurance products...');
  const insuranceProduct = await stripe.products.create({
    name: 'Damage Waiver Insurance',
    description: 'Vehicle damage protection coverage',
    metadata: {
      category: 'protection',
      type: 'insurance',
      carhop_id: 'insurance',
    },
  });
  console.log(`✅ Product created: ${insuranceProduct.id}\n`);

  // Create 2 insurance prices
  const insurance500 = await stripe.prices.create({
    product: insuranceProduct.id,
    unit_amount: 2500, // $25.00
    currency: 'usd',
    metadata: {
      coverage_limit: '500',
      deductible: '500',
    },
  });
  console.log(`✅ Insurance $500 deductible: ${insurance500.id}`);
  console.log(`   Price: $${(insurance500.unit_amount! / 100).toFixed(2)}\n`);

  const insurance1000 = await stripe.prices.create({
    product: insuranceProduct.id,
    unit_amount: 1500, // $15.00
    currency: 'usd',
    metadata: {
      coverage_limit: '1000',
      deductible: '1000',
    },
  });
  console.log(`✅ Insurance $1000 deductible: ${insurance1000.id}`);
  console.log(`   Price: $${(insurance1000.unit_amount! / 100).toFixed(2)}\n`);

  // 3. Child Seat Add-on
  console.log('📦 Creating Child Seat product...');
  const childSeatProduct = await stripe.products.create({
    name: 'Child Safety Seat',
    description: 'Infant/toddler car safety seat (age appropriate)',
    metadata: {
      category: 'addon',
      type: 'child_seat',
      carhop_id: 'child_seat',
    },
  });
  console.log(`✅ Product created: ${childSeatProduct.id}\n`);

  const childSeatPrice = await stripe.prices.create({
    product: childSeatProduct.id,
    unit_amount: 800, // $8.00
    currency: 'usd',
    metadata: {
      age_groups: 'infant_to_child',
    },
  });
  console.log(`✅ Child Seat price: ${childSeatPrice.id}`);
  console.log(`   Price: $${(childSeatPrice.unit_amount! / 100).toFixed(2)}\n`);

  // 4. Cleaning Fee
  console.log('📦 Creating Cleaning Fee product...');
  const cleaningFeeProduct = await stripe.products.create({
    name: 'Interior Detailing',
    description: 'Professional interior cleaning and detailing service',
    metadata: {
      category: 'service',
      type: 'cleaning',
      carhop_id: 'cleaning_fee',
    },
  });
  console.log(`✅ Product created: ${cleaningFeeProduct.id}\n`);

  const cleaningFeePrice = await stripe.prices.create({
    product: cleaningFeeProduct.id,
    unit_amount: 2500, // $25.00
    currency: 'usd',
  });
  console.log(`✅ Cleaning Fee price: ${cleaningFeePrice.id}`);
  console.log(`   Price: $${(cleaningFeePrice.unit_amount! / 100).toFixed(2)}\n`);

  // 5. Extra Miles
  console.log('📦 Creating Extra Miles product...');
  const extraMilesProduct = await stripe.products.create({
    name: 'Extra Mileage',
    description: 'Charge for miles driven over included mileage',
    metadata: {
      category: 'addon',
      type: 'extra_miles',
      carhop_id: 'extra_miles',
    },
  });
  console.log(`✅ Product created: ${extraMilesProduct.id}\n`);

  const extraMilesPrice = await stripe.prices.create({
    product: extraMilesProduct.id,
    unit_amount: 45, // $0.45 per mile
    currency: 'usd',
    metadata: {
      per_unit: 'mile',
    },
  });
  console.log(`✅ Extra Miles price: ${extraMilesPrice.id}`);
  console.log(`   Price: $${(extraMilesPrice.unit_amount! / 100).toFixed(2)}/mile\n`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY - Products Created Successfully');
  console.log('='.repeat(60) + '\n');

  console.log('Copy these Price IDs to use in your CarHop application:\n');
  console.log(`Daily Rental (per day):      ${dailyRentalPrice.id}`);
  console.log(`Insurance $500 deductible:   ${insurance500.id}`);
  console.log(`Insurance $1000 deductible:  ${insurance1000.id}`);
  console.log(`Child Seat:                  ${childSeatPrice.id}`);
  console.log(`Cleaning Fee:                ${cleaningFeePrice.id}`);
  console.log(`Extra Miles (per mile):      ${extraMilesPrice.id}`);
  console.log('\n' + '='.repeat(60) + '\n');

  console.log('✨ To update prices or products, visit your Stripe Dashboard:');
  console.log('   https://dashboard.stripe.com/products\n');
}

// Run the script
createCarRentalProducts().catch(error => {
  console.error('❌ Error creating products:', error.message);
  process.exit(1);
});
