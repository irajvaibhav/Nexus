type IconProps = { className?: string };

const base = "none";

export function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function DocumentsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="12" height="18" rx="1.6" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H10l-4.5 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" />
    </svg>
  );
}

export function ScanIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" />
      <circle cx="12" cy="12" r="3.1" strokeWidth="2" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M7 9a5 5 0 0 1 10 0v4l1.5 3h-13L7 13V9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function CheckSquareIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="3.2" />
      <path d="M8.2 12.4 10.6 14.8 15.8 9.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ActivityIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.4M12 18.6V21M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M3 12h2.4M18.6 12H21M4.5 19.5l1.7-1.7M17.8 6.2l1.7-1.7" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function PaperclipIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 11.5-8.8 8.8a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a1.5 1.5 0 0 1-2.1-2.1L15.5 7" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5c.4 3.9 2.6 6.1 6.5 6.5-3.9.4-6.1 2.6-6.5 6.5-.4-3.9-2.6-6.1-6.5-6.5 3.9-.4 6.1-2.6 6.5-6.5ZM5.5 14c.2 1.9 1.3 3 3.2 3.2-1.9.2-3 1.3-3.2 3.2-.2-1.9-1.3-3-3.2-3.2 1.9-.2 3-1.3 3.2-3.2Z" />
    </svg>
  );
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </svg>
  );
}

export function IdCardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" fill="currentColor" fillOpacity="0.22" />
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <circle cx="8.5" cy="10.5" r="2.2" fill="currentColor" fillOpacity="0.9" stroke="none" />
      <path d="M5 16c.7-1.7 1.9-2.6 3.5-2.6S11.3 14.3 12 16" />
      <path d="M14.5 9.5h4.5M14.5 12.5h4.5M14.5 15.5h3" />
    </svg>
  );
}

export function BankIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 9.5 12 3.5l9.5 6H2.5Z" fill="currentColor" fillOpacity="0.28" />
      <path d="M2.5 9.5 12 3.5l9.5 6H2.5Z" />
      <path d="M5 9.5v8M9.7 9.5v8M14.3 9.5v8M19 9.5v8" />
      <rect x="3" y="17.5" width="18" height="3" rx="1" fill="currentColor" fillOpacity="0.9" stroke="none" />
      <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13.5 5.2 8.3A2 2 0 0 1 7 7h10a2 2 0 0 1 1.8 1.3L21 13.5v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17h-11v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M3 13.5 5.2 8.3A2 2 0 0 1 7 7h10a2 2 0 0 1 1.8 1.3L21 13.5v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17h-11v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z" />
      <path d="M3.5 13.5h17" />
      <circle cx="7" cy="15.3" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="15.3" r="1.2" fill="currentColor" stroke="none" />
      <path d="M8 10.5h8" strokeOpacity="0.7" />
    </svg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6a2 2 0 0 1 1.5.7L12 7.5h6.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6a2 2 0 0 1 1.5.7L12 7.5h6.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
      <path d="M3 11h18" />
      <path d="M9 15h6" strokeOpacity="0.8" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M10.6 6.3A9.8 9.8 0 0 1 12 6.2c4.5 0 8 3.4 9.5 5.8-.5.8-1.3 1.9-2.4 2.9M6.5 8.4C4.8 9.6 3.4 11 2.5 12c1.5 2.4 5 5.8 9.5 5.8 1.3 0 2.5-.3 3.6-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 5 6v5.5c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
