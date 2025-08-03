import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  useEffect(() => {
    // Scroll to top when location changes
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Also scroll window to top as fallback
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location]);

  return (
    <div 
      key={location.pathname} 
      className="page-fade-in bg-background min-h-screen"
      style={{
        animation: "fadeSlide 400ms ease-out"
      }}
    >
      {children}
    </div>
  );
}