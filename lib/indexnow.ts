
/**
 * Client-side IndexNow utilities
 */

interface IndexNowStatus {
  keyLocation: string;
  supportedEngines: number;
  monitoredUrls: number;
  lastSubmission: string;
}

/**
 * Submit URLs to search engines via IndexNow
 */
export async function submitToIndexNow(urls?: string[]): Promise<boolean> {
  try {
    const response = await fetch('/api/indexnow/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ IndexNow submission successful:', result.message);
      return true;
    } else {
      console.warn('⚠️ IndexNow submission failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ IndexNow submission error:', error);
    return false;
  }
}

/**
 * Submit all site URLs to search engines
 */
export async function submitAllUrls(): Promise<boolean> {
  return submitToIndexNow();
}

/**
 * Submit current page to search engines
 */
export async function submitCurrentPage(): Promise<boolean> {
  const currentUrl = window.location.href;
  return submitToIndexNow([currentUrl]);
}

/**
 * Get IndexNow service status
 */
export async function getIndexNowStatus(): Promise<IndexNowStatus | null> {
  try {
    const response = await fetch('/api/indexnow/status');
    if (response.ok) {
      return response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to get IndexNow status:', error);
    return null;
  }
}

/**
 * Automatically submit page when content changes significantly
 */
export function setupAutoSubmission() {
  // Submit current page on certain user actions
  const submitCurrentPageSafely = () => {
    submitCurrentPage().catch(error => 
      console.warn('Auto-submission failed:', error)
    );
  };

  // Submit when user shares content (suggests content is worth indexing)
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-share]') || target.closest('.social-share')) {
      setTimeout(submitCurrentPageSafely, 1000);
    }
  });

  // Submit when user successfully donates (suggests page engagement)
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'payment_success') {
      setTimeout(submitCurrentPageSafely, 2000);
    }
  });
}
