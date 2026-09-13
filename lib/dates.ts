export function daysLeft(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function badgeColorFor(days: number): string {
  if (days <= 7) return "bg-[#EAF2FF] text-[#2563EB] border border-[#CFE0FF]";
  if (days <= 30) return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
  return "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]";
}

export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  return `${days} days left`;
}
