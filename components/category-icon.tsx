import { IdCardIcon, BankIcon, CarIcon, FolderIcon } from "@/components/icons";

// Built-in categories get drawn icons in the same gradient-tile language as
// the Home actions; custom categories keep the emoji the user picked.
const BUILT_IN: Record<string, { icon: React.ReactNode; tone: string }> = {
  "Essential Docs": { icon: <IdCardIcon className="w-6 h-6" />, tone: "from-[#2563EB] to-[#4F46E5]" },
  "Bank Docs": { icon: <BankIcon className="w-6 h-6" />, tone: "from-[#16A34A] to-[#0D9488]" },
  "Vehicle": { icon: <CarIcon className="w-6 h-6" />, tone: "from-[#F59E0B] to-[#EA580C]" },
  "Non Essential Docs": { icon: <FolderIcon className="w-6 h-6" />, tone: "from-[#64748B] to-[#334155]" },
};

export function CategoryIcon({ name, emoji, size = "md" }: { name: string; emoji?: string; size?: "sm" | "md" }) {
  const built = BUILT_IN[name];
  const box = size === "sm" ? "w-7 h-7 rounded-lg text-sm" : "w-14 h-14 rounded-2xl text-xl";
  if (built) {
    return (
      <span className={`${box} bg-gradient-to-br ${built.tone} text-white flex items-center justify-center shadow-md shadow-[#0F172A]/10`}>
        {size === "sm" ? <span className="scale-75">{built.icon}</span> : built.icon}
      </span>
    );
  }
  return (
    <span className={`${box} bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-[#6D28D9] flex items-center justify-center`}>
      {emoji || "🗂️"}
    </span>
  );
}
