export type CategoryOption = {
  name: string;
  icon: string;
  color: string;
};

export const BUILT_IN_CATEGORIES: CategoryOption[] = [
  { name: "Essential Docs", icon: "🪪", color: "bg-[#EAF2FF] text-[#2563EB] border border-[#CFE0FF]" },
  { name: "Bank Docs", icon: "🏦", color: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]" },
  { name: "Vehicle", icon: "🚗", color: "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]" },
  { name: "Non Essential Docs", icon: "📁", color: "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]" },
];

const CUSTOM_COLOR_PALETTE = [
  "bg-[#EAF2FF] text-[#2563EB] border border-[#CFE0FF]",
  "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]",
  "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]",
  "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]",
  "bg-[#FDF2F8] text-[#DB2777] border border-[#FBCFE8]",
  "bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]",
];

export type CustomCategoryRow = { name: string; icon: string };

export function mergeCategories(custom: CustomCategoryRow[]): CategoryOption[] {
  return [
    ...BUILT_IN_CATEGORIES,
    ...custom.map((c, i) => ({
      name: c.name,
      icon: c.icon || "🗂️",
      color: CUSTOM_COLOR_PALETTE[i % CUSTOM_COLOR_PALETTE.length],
    })),
  ];
}
