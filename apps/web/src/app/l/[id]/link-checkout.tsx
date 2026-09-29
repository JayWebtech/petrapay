"use client";

import { ZEC_ASSET_ID, type LinkCheckoutDTO, type PublicLinkDTO, type QuotePreviewDTO, type TokenDTO } from "@petrapay/shared";
import { PauseCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChooseStep } from "@/components/app/checkout/choose-step";
import { CheckoutFrame } from "@/components/app/checkout/frame";
import { ReviewStep } from "@/components/app/checkout/review-step";
import { rememberPayment } from "@/components/app/checkout/storage";
import { StepHeader, estimateIn, invoiceUsd } from "@/components/app/checkout/utils";
import { useToast } from "@/components/app/toaster";
import { TokenSelector } from "@/components/app/token-selector";
import { useTokens } from "@/hooks/use-tokens";
import { api, errorMessage } from "@/lib/api";
import { sealFor, type SealedResponses } from "@/lib/box";
import { DetailsStep } from "./details-step";
import { LinkPanel } from "./link-panel";

type Step = "details" | "choose" | "review";

/**
 * A reusable payment link. The payer settles the amount and answers the creator's questions,
 * picks how to pay, and only then is an invoice created for them. From there the regular
 * invoice checkout at /pay/<id> takes over, which is also their receipt.
 */
export function LinkCheckout({ link }: { link: PublicLinkDTO }) {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTokens();
  const fixed = link.amountType === "FIXED";
  const needsDetails = !fixed || link.fields.length > 0;
  const [step, setStep] = useState<Step>(needsDetails ? "details" : "choose");
  const [amount, setAmount] = useState(fixed ? link.amount! : "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [token, setToken] = useState<TokenDTO | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [zecPending, setZecPending] = useState(false);

  const usd = invoiceUsd({ currency: link.currency, amount, zecPriceUsd: link.zecPriceUsd });

  const pick = (t: TokenDTO) => {
    setToken(t);
    setStep("review");
  };

  /** Seals the answers to the creator's key in this browser. The server only ever sees ciphertext. */
  const sealedResponses = async (): Promise<string | undefined> => {
    const fields = link.fields.map((f) => ({ id: f.id, label: f.label, value: (values[f.id] ?? "").trim() })).filter((f) => f.value);
    if (!fields.length || !link.boxPublicKey) return undefined;
    return sealFor(link.boxPublicKey, JSON.stringify({ v: 1, fields } satisfies SealedResponses));
  };

  const checkout = async (body: { method: "token" | "zec"; originAsset?: string; refundTo?: string }) =>
    api<LinkCheckoutDTO>(`/public/links/${link.id}/checkout`, { body: { amount, responses: await sealedResponses(), ...body } });

  const payWithZec = async () => {
    setZecPending(true);
    try {
      const { invoice } = await checkout({ method: "zec" });
      router.push(`/pay/${invoice.id}?method=zec`);
    } catch (err) {
      toast.error("Couldn't start payment", errorMessage(err));
      setZecPending(false);
    }
  };

  const stage = link.active ? step : "paused";

  return (
    <CheckoutFrame
      panel={<LinkPanel link={link} amount={amount} />}
      stage={stage}
      overlay={
        <TokenSelector
          open={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          tokens={tokens ?? []}
          exclude={[ZEC_ASSET_ID]}
          selectedId={token?.assetId}
          onSelect={pick}
          estimate={(t) => estimateIn(t, usd)}
          title="Pay with"
        />
      }
    >
      {stage === "paused" ? (
        <StepHeader
          icon={<PauseCircle className="size-6 text-muted-foreground" />}
          title="This link is paused"
          body={`${link.creatorName} isn't accepting payments through this link right now.`}
        />
      ) : stage === "details" ? (
        <DetailsStep
          link={link}
          amount={amount}
          onAmount={setAmount}
          values={values}
          onValue={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
          onContinue={() => setStep("choose")}
        />
      ) : stage === "review" && token ? (
        <ReviewStep
          payee={link.creatorName}
          token={token}
          fetchPreview={(originAsset) => api<QuotePreviewDTO>(`/public/links/${link.id}/quote`, { body: { amount, originAsset } })}
          commit={async (originAsset, refundTo) => {
            const { invoice, swap } = await checkout({ method: "token", originAsset, refundTo });
            if (swap) rememberPayment(invoice.id, swap.id);
            router.push(`/pay/${invoice.id}`);
          }}
          onChangeToken={() => setSelectorOpen(true)}
          onBack={() => setStep("choose")}
        />
      ) : (
        <ChooseStep
          payee={link.creatorName}
          usd={usd}
          tokens={tokens}
          onPick={pick}
          onBrowse={() => setSelectorOpen(true)}
          onZec={payWithZec}
          onBack={needsDetails ? () => setStep("details") : undefined}
          zecPending={zecPending}
        />
      )}
    </CheckoutFrame>
  );
}
