
interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="#2563eb" stroke="#1e40af" strokeWidth="2"/>
      
      {/* Document icon */}
      <rect x="30" y="25" width="24" height="32" rx="2" fill="white" opacity="0.9"/>
      <rect x="32" y="29" width="20" height="2" fill="#2563eb" opacity="0.7"/>
      <rect x="32" y="33" width="16" height="1.5" fill="#2563eb" opacity="0.5"/>
      <rect x="32" y="36" width="18" height="1.5" fill="#2563eb" opacity="0.5"/>
      <rect x="32" y="39" width="14" height="1.5" fill="#2563eb" opacity="0.5"/>
      
      {/* Magnifying glass */}
      <circle cx="65" cy="45" r="8" fill="none" stroke="white" strokeWidth="2.5"/>
      <line x1="71" y1="51" x2="76" y2="56" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      
      {/* Check mark overlay */}
      <circle cx="72" cy="72" r="12" fill="#10b981"/>
      <path d="M67 72 L70 75 L77 68" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Brand initials */}
      <text x="50" y="88" textAnchor="middle" fontSize="8" fill="white" fontFamily="Arial, sans-serif" fontWeight="bold">
        RMFP
      </text>
    </svg>
  );
}