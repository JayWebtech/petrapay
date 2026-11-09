"use client";

import type { PaymentLinkDetailDTO } from "@petrapay/shared";
import { useParams } from "next/navigation";
import { LinkForm } from "@/components/app/links/link-form";
import { Loader } from "@/components/motion/loader";
import { useApi } from "@/hooks/use-api";

export default function EditLinkPage() {
  const { id } = useParams<{ id: string }>();
  const { data: link, error } = useApi<PaymentLinkDetailDTO>(`/links/${id}`);

  if (error && !link) return <p className="text-sm text-destructive">{error}</p>;
  if (!link) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader variant="dots" size={24} />
      </div>
    );
  }
  // Keyed so the form starts from the loaded link's values.
  return <LinkForm key={link.id} link={link} />;
}
