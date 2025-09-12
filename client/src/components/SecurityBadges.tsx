import { Shield, Lock, CheckCircle } from "lucide-react";

interface SecurityBadgeProps {
  variant?: 'full' | 'privacy' | 'footer' | 'compact';
  className?: string;
}

export function SecurityBadges({ variant = 'full', className = '' }: SecurityBadgeProps) {
  const badgeBaseClass = "inline-block transition-transform hover:scale-105";
  
  const allBadges = [
    {
      src: "https://img.shields.io/badge/Security-OWASP%20Practices-blue",
      alt: "OWASP Security Practices",
      title: "Following OWASP security guidelines"
    },
    {
      src: "https://img.shields.io/badge/Standards-Security%20Focused-green",
      alt: "Security Focused",
      title: "Designed with security best practices"
    },
    {
      src: "https://img.shields.io/badge/Privacy-GDPR%20Aligned-blue",
      alt: "GDPR Aligned",
      title: "Aligned with European data protection regulation"
    },
    {
      src: "https://img.shields.io/badge/Privacy-CCPA%20Aligned-blue",
      alt: "CCPA Aligned",
      title: "Aligned with California consumer privacy act"
    },
    {
      src: "https://img.shields.io/badge/Encryption-AES%20256-blue",
      alt: "AES 256 Encryption",
      title: "Strong encryption for data protection"
    },
    {
      src: "https://img.shields.io/badge/OWASP-ASVS%20Ready-blue",
      alt: "OWASP ASVS Ready",
      title: "Follows OWASP Application Security Verification Standard"
    }
  ];

  const privacyBadges = [
    allBadges[2], // GDPR
    allBadges[3], // CCPA
    allBadges[4], // Encryption
    allBadges[0]  // Security Score
  ];

  const footerBadges = [
    allBadges[0], // Security Score
    allBadges[1], // Zero Vulnerabilities
    allBadges[4]  // Encryption
  ];

  const compactBadges = [
    allBadges[0], // Security Score
    allBadges[2]  // GDPR
  ];

  let badgesToShow;
  switch (variant) {
    case 'privacy':
      badgesToShow = privacyBadges;
      break;
    case 'footer':
      badgesToShow = footerBadges;
      break;
    case 'compact':
      badgesToShow = compactBadges;
      break;
    default:
      badgesToShow = allBadges;
  }

  if (variant === 'full') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-green-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">Security Certifications</h4>
        </div>
        
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-800 dark:text-green-200">Security Practices</span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Strong security practices with privacy-focused protection and ongoing compliance efforts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {badgesToShow.map((badge, index) => (
            <img
              key={index}
              src={badge.src}
              alt={badge.alt}
              title={badge.title}
              className={badgeBaseClass}
              loading="lazy"
            />
          ))}
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          <Lock className="w-3 h-3 inline mr-1" />
          Security verified: {new Date().toLocaleDateString()}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badgesToShow.map((badge, index) => (
        <img
          key={index}
          src={badge.src}
          alt={badge.alt}
          title={badge.title}
          className={badgeBaseClass}
          loading="lazy"
        />
      ))}
    </div>
  );
} 