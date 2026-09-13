// A colour per document family, so a glance tells a passport from a bill.
export function DocIcon({ docType, fileName }: { docType: string | null; fileName: string }) {
  const t = (docType || "").toLowerCase();
  const [emoji, tone] =
    /passport|aadhaar|aadhar|pan|voter|licen|id/.test(t) ? ["🪪", "from-[#DBEAFE] to-[#BFDBFE] text-[#1D4ED8]"]
    : /insurance|policy/.test(t) ? ["🛡️", "from-[#FEF3C7] to-[#FDE68A] text-[#B45309]"]
    : /bank|statement|account|tax|form|salary|invoice/.test(t) ? ["🏦", "from-[#DCFCE7] to-[#BBF7D0] text-[#15803D]"]
    : /vehicle|rc|registration|puc/.test(t) ? ["🚗", "from-[#EDE9FE] to-[#DDD6FE] text-[#6D28D9]"]
    : /lease|rent|property|agreement|contract/.test(t) ? ["🏠", "from-[#FCE7F3] to-[#FBCFE8] text-[#BE185D]"]
    : fileName.toLowerCase().endsWith(".pdf") ? ["📄", "from-[#F1F5F9] to-[#E2E8F0] text-[#334155]"]
    : ["🖼️", "from-[#F1F5F9] to-[#E2E8F0] text-[#334155]"];
  return (
    <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center text-lg shrink-0`}>
      {emoji}
    </span>
  );
}

