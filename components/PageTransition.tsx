import { useEffect } from "react";
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  useEffect(() => {
    // Scroll to top when location changes
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Also scroll window to top as fallback
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <div 
      key={pathname} 
      className="page-fade-in bg-background min-h-screen"
      style={{
        animation: "fadeSlide 400ms ease-out"
      }}
    >
      {children}
    </div>
  );
}