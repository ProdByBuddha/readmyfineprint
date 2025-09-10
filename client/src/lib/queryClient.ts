import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Session ID management - use sessionStorage for consistency
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('app-session-id');
  if (!sessionId) {
    sessionId = crypto.getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    sessionStorage.setItem('app-session-id', sessionId);
    console.log('Generated new session ID:', sessionId);
  }
  return sessionId;
}

function updateSessionId(sessionId: string) {
  const currentSessionId = sessionStorage.getItem('app-session-id');
  if (sessionId && sessionId !== currentSessionId) {
    sessionStorage.setItem('app-session-id', sessionId);
    console.log('Updated session ID:', sessionId);
  }
}

export function clearSession() {
  sessionStorage.removeItem('app-session-id');
  console.log('Cleared session ID');
}

// Function to check if response indicates consent is required
function isConsentRequired(res: Response): boolean {
  return res.status === 403;
}

// Function to trigger consent modal when needed
function triggerConsentModal() {
  // Dispatch custom event that components can listen to
  window.dispatchEvent(new CustomEvent('consentRequired', { 
    detail: { reason: 'API request blocked - consent required' }
  }));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Check if this is a consent requirement error
    if (isConsentRequired(res)) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.code === 'CONSENT_REQUIRED') {
          triggerConsentModal();
        }
      } catch (e) {
        // If parsing fails, still trigger consent modal for 403 errors
        triggerConsentModal();
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  options?: {
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<Response> {
  const customHeaders = options?.headers || {};
  
  const headers: Record<string, string> = {
    'x-session-id': getSessionId(),
    ...customHeaders,
  };

  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });

  // Update session ID if server provides one
  const serverSessionId = res.headers.get('x-session-id');
  if (serverSessionId) {
    updateSessionId(serverSessionId);
  }

  if (!res.ok) {
    const text = await res.text();
    
    // Check if this is a consent requirement error
    if (isConsentRequired(res)) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.code === 'CONSENT_REQUIRED') {
          triggerConsentModal();
        }
      } catch (e) {
        // If parsing fails, still trigger consent modal for 403 errors
        triggerConsentModal();
      }
    }
    
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      headers: {
        'x-session-id': getSessionId(),
      },
      credentials: "include",
    });

    // Update session ID if server provides one
    const serverSessionId = res.headers.get('x-session-id');
    if (serverSessionId) {
      updateSessionId(serverSessionId);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Check for consent requirement before throwing
    if (isConsentRequired(res)) {
      const text = await res.text();
      try {
        const errorData = JSON.parse(text);
        if (errorData.code === 'CONSENT_REQUIRED') {
          triggerConsentModal();
        }
      } catch (e) {
        triggerConsentModal();
      }
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchIntervalInBackground: false,
      notifyOnChangeProps: ['data', 'error'],
      staleTime: Infinity, // Never consider data stale
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: false,
      structuralSharing: false, // Disable to prevent unnecessary re-renders
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        // Check if the error indicates consent is required
        if (error?.message?.includes('403') && error?.message?.includes('CONSENT_REQUIRED')) {
          console.log('Mutation error indicates consent required, triggering consent modal');
          triggerConsentModal();
        }
      },
    },
  },
});
