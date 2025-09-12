import { useEffect } from 'react';

/**
 * Trade Secret Protection Component
 * 
 * Implements client-side measures to protect proprietary technology
 * information from being easily discovered or reverse-engineered.
 * 
 * IMPORTANT: These are basic deterrent measures, not foolproof security.
 * Real protection comes from not exposing sensitive information in the first place.
 */

const TradeSecretProtection: React.FC = () => {
  useEffect(() => {
    // Disable right-click context menu
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable common developer shortcuts
    const disableDevTools = (e: KeyboardEvent) => {
      // F12 - Developer Tools
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I - Developer Tools
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C - Element Inspector
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U - View Source
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+S - Save Page
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }
    };

    // Disable text selection on sensitive content
    const disableSelection = () => {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      (document.body.style as any).msUserSelect = 'none';
    };

    // Add event listeners
    document.addEventListener('contextmenu', disableContextMenu);
    document.addEventListener('keydown', disableDevTools);
    
    // Apply selection restrictions to body
    disableSelection();

    // Console warning for developers
    // Disabled console clearing for debugging
    // if (!import.meta.env.DEV) {
    //   console.clear();
    // }
    console.log('%c🔒 PRIVACY-FIRST DOCUMENT ANALYSIS', 'color: blue; font-size: 24px; font-weight: bold;');
    console.log('%cThis application uses proprietary privacy-preserving technology protected by trade secret laws.', 'color: orange; font-size: 14px;');
    console.log('%cOur security processes your information safely and deletes it immediately after analysis.', 'color: green; font-size: 14px;');
    console.log('%cFor security inquiries, contact: security@readmyfineprint.ai', 'color: blue; font-size: 12px;');

    // Monitor for console manipulation attempts
    let devtools = {
      open: false,
      orientation: null as string | null
    };

    const threshold = 160;

    const checkDevTools = () => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          // Disabled console clearing for debugging
          // if (!import.meta.env.DEV) {
          //   console.clear();
          // }
          console.log('%c🛡️ PRIVACY PROTECTION ACTIVE', 'color: green; font-size: 18px; font-weight: bold;');
          console.log('%cYour documents are protected by strong security protocols.', 'color: blue; font-size: 12px;');
          console.log('%cAdvanced privacy technology designed for strong confidentiality.', 'color: blue; font-size: 12px;');
        }
      } else {
        devtools.open = false;
      }
    };

    // Check for developer tools periodically
    const devToolsCheck = setInterval(checkDevTools, 500);

    // Cleanup function
    return () => {
      document.removeEventListener('contextmenu', disableContextMenu);
      document.removeEventListener('keydown', disableDevTools);
      clearInterval(devToolsCheck);
      
      // Restore normal text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      (document.body.style as any).msUserSelect = '';
    };
  }, []);

  return null; // This component doesn't render anything visible
};

export default TradeSecretProtection;