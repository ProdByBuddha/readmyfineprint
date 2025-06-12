import { Shield, Scale, Cookie, Heart, Mail, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

export function Footer() {
  const isMobile = useIsMobile();
  const [location] = useLocation();

  const handleContactClick = () => {
    const user = 'support';
    const domain = 'readmyfineprint.com';
    const subject = encodeURIComponent('ReadMyFinePrint Support Request');
    const body = encodeURIComponent(`Hello ReadMyFinePrint Team,

I would like to get in touch regarding:

[Please describe your inquiry here]

Best regards`);
    
    const now = Date.now();
    const lastAttempt = localStorage.getItem('last-contact-attempt');
    
    if (lastAttempt && (now - parseInt(lastAttempt)) < 5000) {
      return; // Rate limit contact attempts
    }
    
    localStorage.setItem('last-contact-attempt', now.toString());
    window.open(`mailto:${user}@${domain}?subject=${subject}&body=${body}`, '_self');
  };

  const NavigationItem = ({ to, icon: Icon, label, isButton = false, onClick }: {
    to?: string;
    icon: any;
    label: string;
    isButton?: boolean;
    onClick?: () => void;
  }) => {
    const isActive = to === location;
    const className = `
      flex flex-col items-center gap-1 
      ${isMobile ? 'p-2 min-w-[60px]' : 'p-3'} 
      rounded-xl 
      ${isActive 
        ? 'bg-primary/10 text-primary dark:bg-primary/20' 
        : 'text-gray-600 dark:text-gray-400'
      }
      ${isMobile 
        ? 'hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 active:bg-gray-200 dark:active:bg-gray-600' 
        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      } 
      transition-all duration-200 cursor-pointer
    `;

    const content = (
      <>
        <Icon className={`
          ${isMobile ? 'w-5 h-5' : 'w-5 h-5 md:w-6 md:h-6'} 
          ${label === 'Donate' ? 'text-red-500' : isActive ? 'text-primary' : ''}
        `} fill={label === 'Donate' ? 'currentColor' : 'none'} />
        <span className={`
          text-xs font-medium
          ${isActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}
        `}>
          {label}
        </span>
      </>
    );

    if (isButton) {
      return (
        <button onClick={onClick} className={className}>
          {content}
        </button>
      );
    }

    return (
      <Link to={to || '/'} className={className}>
        {content}
      </Link>
    );
  };

  return (
    <footer className="flex-shrink-0 animate-slide-in-up bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50">
      <div className={`px-4 ${isMobile ? 'py-2' : 'py-4'} md:px-6`}>
        {/* Icon Navigation */}
        <div className={`
          flex ${isMobile ? 'justify-around' : 'justify-center md:justify-around'} 
          items-center 
          ${isMobile ? 'py-2' : 'py-3'} 
          ${isMobile ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-800 rounded-lg mb-4'}
        `}>
          <NavigationItem to="/" icon={Home} label="Home" />
          <NavigationItem to="/privacy" icon={Shield} label="Privacy" />
          <NavigationItem to="/terms" icon={Scale} label="Terms" />
          <NavigationItem to="/cookies" icon={Cookie} label="Cookies" />
          <NavigationItem to="/donate" icon={Heart} label="Donate" />
          <NavigationItem 
            icon={Mail} 
            label="Contact" 
            isButton 
            onClick={handleContactClick} 
          />
        </div>
        
        {/* Footer Information - Hidden on mobile for cleaner look */}
        {!isMobile && (
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">
              © {new Date().getFullYear()} ReadMyFinePrint
            </div>
            <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Privacy-First
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Session-Based
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Advanced Analysis
              </span>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}