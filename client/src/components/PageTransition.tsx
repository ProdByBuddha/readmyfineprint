import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();

  return (
    <div 
      key={location} 
      className="page-fade-in bg-background min-h-screen"
      style={{
        animation: "fadeSlide 400ms ease-out"
      }}
    >
      {children}
    </div>
  );
}