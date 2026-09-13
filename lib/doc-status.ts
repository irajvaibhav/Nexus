import { daysLeft } from "@/lib/dates";

export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export type HealthKey = "processing" | "failed" | "expired" | "expiring" | "needs_review" | "healthy";

export type DocHealth = {
  key: HealthKey;
  label: string;
  badge: string;
  action: string;
};

const HEALTH: Record<HealthKey, Omit<DocHealth, "key">> = {
  processing: {
    label: "Reading…",
    badge: "bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]",
    action: "NEXUS is still reading this document",
  },
  failed: {
    label: "Couldn't read",
    badge: "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]",
    action: "Couldn't read this file. Retry or upload a clearer copy",
  },
  expired: {
    label: "Action needed",
    badge: "bg-[#EAF2FF] text-[#2563EB] border border-[#CFE0FF]",
    action: "Expired. See what to do next",
  },
  expiring: {
    label: "Attention",
    badge: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]",
    action: "Expiring soon. Renew or plan it",
  },
  needs_review: {
    label: "Needs review",
    badge: "bg-[#FDF2F8] text-[#DB2777] border border-[#FBCFE8]",
    action: "Some details need a check",
  },
  healthy: {
    label: "Verified",
    badge: "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]",
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
  if (status === "failed") return "failed";

  const soonest = expiryDates.length > 0 ? Math.min(...expiryDates.map(daysLeft)) : null;
  if (soonest !== null && soonest < 0) return "expired";
  if (soonest !== null && soonest <= 30) return "expiring";
  if (lowConfidenceCount > 0) return "needs_review";

  return "healthy";
}
