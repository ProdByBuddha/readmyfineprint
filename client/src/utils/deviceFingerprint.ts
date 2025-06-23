/**
 * Generate a basic device fingerprint for subscription token security
 * This helps detect if a token is being used from a different device
 */

export function generateDeviceFingerprint(): string {
  try {
    const components = [
      // Screen resolution
      `${screen.width}x${screen.height}`,
      
      // Timezone
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      
      // Language
      navigator.language,
      
      // Platform
      navigator.platform,
      
      // User agent (partial - just the browser info)
      navigator.userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] || 'unknown',
      
      // Available fonts (simplified)
      getAvailableFonts(),
      
      // Color depth
      screen.colorDepth.toString(),
    ];
    
    // Create a hash of these components
    const fingerprint = btoa(components.join('|')).slice(0, 32);
    return `fp_${fingerprint}`;
  } catch (error) {
    console.warn('Could not generate device fingerprint:', error);
    return `fp_unknown_${Date.now()}`;
  }
}

function getAvailableFonts(): string {
  // Simple font detection using canvas
  const testFonts = ['Arial', 'Times', 'Courier', 'Helvetica', 'Georgia'];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return 'no-canvas';
  
  const baseFontSize = '16px';
  const testText = 'mmmmmmmmmmlli';
  
  // Measure text with default font
  ctx.font = `${baseFontSize} monospace`;
  const baseWidth = ctx.measureText(testText).width;
  
  const availableFonts = testFonts.filter(font => {
    ctx.font = `${baseFontSize} ${font}, monospace`;
    return ctx.measureText(testText).width !== baseWidth;
  });
  
  return availableFonts.length.toString();
}

/**
 * Store device fingerprint in localStorage for consistency
 */
export function getStoredDeviceFingerprint(): string {
  const stored = localStorage.getItem('deviceFingerprint');
  if (stored && stored.startsWith('fp_')) {
    return stored;
  }
  
  const newFingerprint = generateDeviceFingerprint();
  localStorage.setItem('deviceFingerprint', newFingerprint);
  return newFingerprint;
}