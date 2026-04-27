import Stripe from 'stripe';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Replit-Token': xReplitToken,
    },
  });

  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings || !connectionSettings.settings.publishable || !connectionSettings.settings.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable as string,
    secretKey: connectionSettings.settings.secret as string,
  };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export interface StripeIntentVerifyResult {
  ok: boolean;
  reason?: string;
  status?: string;
  amountPaid?: number;
}

export async function verifyStripePaymentIntent(
  paymentIntentId: string,
  expectedAmount: number,
  currency: string = 'usd',
): Promise<StripeIntentVerifyResult> {
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return { ok: false, reason: 'Missing paymentIntentId' };
  }
  try {
    const stripe = await getUncachableStripeClient();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded' && intent.status !== 'requires_capture') {
      return { ok: false, reason: `Invalid PaymentIntent status: ${intent.status}`, status: intent.status };
    }
    if ((intent.currency || '').toLowerCase() !== currency.toLowerCase()) {
      return { ok: false, reason: `Currency mismatch: expected ${currency}, received ${intent.currency}` };
    }
    const expectedCents = Math.round(expectedAmount * 100);
    const intentAmount = intent.amount || 0;
    if (Math.abs(intentAmount - expectedCents) > 1) {
      return { ok: false, reason: `Amount mismatch: expected ${expectedCents}, charged ${intentAmount}` };
    }
    return { ok: true, status: intent.status, amountPaid: intentAmount };
  } catch (err: any) {
    console.error('[Stripe] verifyStripePaymentIntent error:', err?.message || err);
    return { ok: false, reason: err?.message || 'Failed to validate Stripe payment' };
  }
}
