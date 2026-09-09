import { daysLeft } from "@/lib/dates";

export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export type HealthKey = "processing" | "expired" | "expiring" | "needs_review" | "healthy";

export type DocHealth = {
  key: HealthKey;
  label: string;
  badge: string;
  action: string;
};

const HEALTH: Record<HealthKey, Omit<DocHealth, "key">> = {
  processing: {
    label: "Reading…",
    badge: "bg-[#EFF7F6] text-[#4F8B82] border border-[#D5EAE7]",
    action: "NEXUS is still reading this document",
  },
  expired: {
    label: "Action needed",
    badge: "bg-[#FDF2EE] text-[#D95D39] border border-[#F5DFD6]",
    action: "This has expired — see what to do next",
  },
  expiring: {
    label: "Attention",
    badge: "bg-[#FEF9EC] text-[#D48C2B] border border-[#FBEAC9]",
    action: "Expiring soon — renew or plan it",
  },
  needs_review: {
    label: "Needs review",
    badge: "bg-[#FDF1F5] text-[#C05C7B] border border-[#F9DFE6]",
    action: "NEXUS wasn't sure about some details — check them",
  },
  healthy: {
    label: "Verified",
    badge: "bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]",
    action: "Everything looks in order",
  },
};

export function docHealth(input: {
  status: string;
  lowConfidenceCount: number;
  expiryDates: string[];
}): DocHealth {
  const key = resolveKey(input);
  return { key, ...HEALTH[key] };
}

function resolveKey({
  status,
  lowConfidenceCount,
  expiryDates,
}: {
  status: string;
  lowConfidenceCount: number;
  expiryDates: string[];
}): HealthKey {
  if (status === "processing" || status === "uploaded") return "processing";

  const soonest = expiryDates.length > 0 ? Math.min(...expiryDates.map(daysLeft)) : null;
  if (soonest !== null && soonest < 0) return "expired";
  if (soonest !== null && soonest <= 30) return "expiring";
  if (lowConfidenceCount > 0) return "needs_review";

  return "healthy";
}
