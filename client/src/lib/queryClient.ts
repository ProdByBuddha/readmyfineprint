import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Session ID management
let currentSessionId: string | null = null;

function getSessionId(): string {
  if (!currentSessionId) {
    // Generate a new session ID
    currentSessionId = crypto.getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    console.log('Generated new session ID:', currentSessionId);
  }
  return currentSessionId;
}

function updateSessionId(sessionId: string) {
  if (sessionId && sessionId !== currentSessionId) {
    currentSessionId = sessionId;
    console.log('Updated session ID:', currentSessionId);
  }
}

export function clearSession() {
  currentSessionId = null;
  sessionStorage.removeItem('app-session-id');
  console.log('Cleared session ID');
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    'x-session-id': getSessionId(),
  };

  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Update session ID if server provides one
  const serverSessionId = res.headers.get('x-session-id');
  if (serverSessionId) {
    updateSessionId(serverSessionId);
  }

  await throwIfResNotOk(res);
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

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
