"use client";

import { useState, useEffect } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createSetupIntent } from "@/lib/supabase/operations/prices";
import { useTheme } from "next-themes";

// Initialize Stripe outside of component to avoid recreating on every render
let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error("Stripe publishable key is not configured");
      return null;
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

interface PaymentMethodFormProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface SetupFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function SetupForm({ onSuccess, onCancel }: SetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}`,
        },
        redirect: "if_required",
      });

      if (submitError) {
        setError(submitError.message || "An error occurred while saving the payment method");
      } else {
        // Success - payment method was saved
        onSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Setup confirmation error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-background">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !elements || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save payment method"
          )}
        </Button>
      </div>
    </form>
  );
}

export function PaymentMethodForm({
  organizationId,
  onSuccess,
  onCancel,
}: PaymentMethodFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    async function initSetupIntent() {
      setIsLoading(true);
      setError(null);

      const result = await createSetupIntent(organizationId);

      if (result.error) {
        setError(result.error);
      } else if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        setError("Failed to initialize payment setup");
      }

      setIsLoading(false);
    }

    initSetupIntent();
  }, [organizationId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>Unable to initialize payment form</AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const stripePromise = getStripe();

  if (!stripePromise) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Stripe is not configured. Please contact support.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: isDark ? "night" : "stripe",
          variables: {
            colorPrimary: isDark ? "#e2e8f0" : "#0f172a",
            borderRadius: "8px",
          },
        },
      }}
    >
      <SetupForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

