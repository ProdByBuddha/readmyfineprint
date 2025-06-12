import { useState, useEffect } from 'react';

// Hook for managing cookie consent status
export function useCookieConsent() {
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    const consentAccepted = localStorage.getItem('cookie-consent-accepted');
    setIsAccepted(consentAccepted === 'true');
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent-accepted', 'true');
    setIsAccepted(true);
    window.location.reload();
  };

  const revokeCookies = () => {
    localStorage.removeItem('cookie-consent-accepted');
    setIsAccepted(false);
    window.location.reload();
  };

  return {
    isAccepted,
    acceptCookies,
    revokeCookies,
  };
}

// Empty component since we no longer show a popup
export function CookieConsent() {
  return null;
}