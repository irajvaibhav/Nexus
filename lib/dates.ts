export function daysLeft(dateStr: string): number {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function badgeColorFor(days: number): string {
  if (days <= 7) return "bg-[#FDF2EE] text-[#D95D39] border border-[#F5DFD6]";
  if (days <= 30) return "bg-[#FEF9EC] text-[#D48C2B] border border-[#FBEAC9]";
  return "bg-[#F3F6F1] text-[#6E885B] border border-[#E1EAD8]";
}

export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  return `${days} days left`;
}
