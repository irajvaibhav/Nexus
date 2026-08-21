export type CategoryOption = {
  name: string;
  icon: string;
  color: string;
};

export const BUILT_IN_CATEGORIES: CategoryOption[] = [
  { name: "Essential Docs", icon: "🪪", color: "bg-[#FDF2EE] text-[#D95D39] border border-[#F5DFD6]" },
  { name: "Bank Docs", icon: "🏦", color: "bg-[#FEF9EC] text-[#D48C2B] border border-[#FBEAC9]" },
  { name: "Vehicle", icon: "🚗", color: "bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]" },
  { name: "Non Essential Docs", icon: "📁", color: "bg-[#F8F6F3] text-[#7C6E67] border border-[#ECE7E1]" },
];

const CUSTOM_COLOR_PALETTE = [
  "bg-[#FDF2EE] text-[#D95D39] border border-[#F5DFD6]",
  "bg-[#FEF9EC] text-[#D48C2B] border border-[#FBEAC9]",
  "bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]",
  "bg-[#F8F6F3] text-[#7C6E67] border border-[#ECE7E1]",
  "bg-[#FDF1F5] text-[#C05C7B] border border-[#F9DFE6]",
  "bg-[#EFF7F6] text-[#4F8B82] border border-[#D5EAE7]",
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
