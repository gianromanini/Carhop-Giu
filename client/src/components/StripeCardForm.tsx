import { useEffect, useState, useMemo } from 'react';
import { loadStripe, type Stripe as StripeType } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Loader, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface StripePaymentResult {
  paymentIntentId: string;
  brand: string;
  last4: string;
  cardName: string;
}

interface StripeCardFormProps {
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string | number | undefined | null>;
  disabled?: boolean;
  disabledReason?: string;
  isParentProcessing?: boolean;
  buttonLabel?: string;
  onPaymentSuccess: (info: StripePaymentResult) => void;
}

let stripePromiseCache: Promise<StripeType | null> | null = null;
async function getStripePromise(): Promise<StripeType | null> {
  if (stripePromiseCache) return stripePromiseCache;
  stripePromiseCache = (async () => {
    try {
      const res = await fetch('/api/stripe/config');
      if (!res.ok) throw new Error('Failed to load Stripe config');
      const data = await res.json();
      if (!data.publishableKey) throw new Error('Missing publishable key');
      return await loadStripe(data.publishableKey);
    } catch (err) {
      console.error('[Stripe] Could not load publishable key:', err);
      return null;
    }
  })();
  return stripePromiseCache;
}

const cardElementOptions = {
  hidePostalCode: false,
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': { color: '#71717a' },
      iconColor: '#22c55e',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

function InnerCardForm(props: StripeCardFormProps) {
  const {
    amount, currency = 'usd', description, metadata,
    disabled, disabledReason, isParentProcessing,
    buttonLabel = 'Pay with Card', onPaymentSuccess,
  } = props;

  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [cardName, setCardName] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);

  const cleanedMetadata = useMemo(() => {
    const out: Record<string, string> = {};
    if (!metadata) return out;
    for (const [k, v] of Object.entries(metadata)) {
      if (v === undefined || v === null) continue;
      out[k] = String(v);
    }
    return out;
  }, [metadata]);

  const isReady = !!stripe && !!elements && cardComplete && cardName.trim().length > 0;
  const isBusy = localProcessing || !!isParentProcessing;
  const isDisabled = !!disabled || !isReady || isBusy;

  const handlePay = async () => {
    if (!stripe || !elements) return;
    if (disabled) {
      toast({ title: 'Missing information', description: disabledReason || 'Please complete all fields before paying.', variant: 'destructive' });
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) return;

    setLocalProcessing(true);
    try {
      const intentRes = await apiRequest('POST', '/api/stripe/create-payment-intent', {
        amount, currency, description, metadata: cleanedMetadata,
      });
      const intentData = await intentRes.json();
      if (!intentData?.clientSecret) {
        throw new Error(intentData?.message || 'Failed to start the payment.');
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card', card,
        billing_details: { name: cardName },
      });
      if (pmError || !paymentMethod) {
        toast({ title: 'Invalid card', description: pmError?.message || 'Could not validate the card.', variant: 'destructive' });
        return;
      }

      const result = await stripe.confirmCardPayment(intentData.clientSecret, {
        payment_method: paymentMethod.id,
      });

      if (result.error) {
        toast({ title: 'Payment declined', description: result.error.message || 'Please try another card.', variant: 'destructive' });
        return;
      }

      const intent = result.paymentIntent;
      if (!intent || (intent.status !== 'succeeded' && intent.status !== 'requires_capture')) {
        toast({ title: 'Payment not completed', description: 'The card did not authorize the amount.', variant: 'destructive' });
        return;
      }

      try {
        await Promise.resolve(onPaymentSuccess({
          paymentIntentId: intent.id,
          brand: paymentMethod.card?.brand || 'card',
          last4: paymentMethod.card?.last4 || '',
          cardName: cardName.trim(),
        }));
      } catch (cbErr: any) {
        console.error('[Stripe] onPaymentSuccess callback error:', cbErr);
        toast({ title: 'Could not confirm booking', description: cbErr?.message || 'Payment was approved, but there was an error saving the booking.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('[Stripe] Payment error:', err);
      toast({ title: 'Payment error', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLocalProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">NAME ON CARD</label>
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder=""
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500 transition-colors"
          data-testid="input-stripe-card-name"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">CARD DETAILS</label>
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 focus-within:border-green-500 transition-colors" data-testid="container-stripe-card">
          <CardElement
            options={cardElementOptions}
            onChange={(e) => setCardComplete(e.complete)}
          />
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
          <Lock size={11} /> Secure payment processed by Stripe.
        </p>
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={isDisabled}
        className={`w-full py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${
          isBusy
            ? 'bg-zinc-700 text-zinc-400 cursor-wait'
            : isDisabled
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
        }`}
        data-testid="button-stripe-pay"
      >
        {isBusy ? (
          <>
            <Loader size={20} className="animate-spin" />
            Processing payment...
          </>
        ) : (
          <>
            <CreditCard size={20} />
            {buttonLabel} · ${amount.toFixed(2)}
          </>
        )}
      </button>

      {disabled && disabledReason && (
        <p className="text-center text-amber-400 text-sm" data-testid="text-stripe-disabled-reason">{disabledReason}</p>
      )}
      {!disabled && !isReady && !isBusy && (
        <p className="text-center text-zinc-500 text-sm">Enter the cardholder name and card details to enable payment.</p>
      )}
    </div>
  );
}

export function StripeCardForm(props: StripeCardFormProps) {
  const [stripe, setStripe] = useState<StripeType | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStripePromise().then((s) => {
      if (cancelled) return;
      if (!s) setLoadError(true);
      else setStripe(s);
    });
    return () => { cancelled = true; };
  }, []);

  if (loadError) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300 text-sm" data-testid="text-stripe-load-error">
        Could not load the payment system. Please try again in a moment.
      </div>
    );
  }

  if (!stripe) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500 text-sm" data-testid="text-stripe-loading">
        <Loader size={18} className="animate-spin mr-2" />
        Loading secure payment...
      </div>
    );
  }

  return (
    <Elements stripe={stripe}>
      <InnerCardForm {...props} />
    </Elements>
  );
}
