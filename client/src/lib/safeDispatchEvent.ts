export interface SafeDispatchOptions<T = unknown> {
  detail?: T;
  bubbles?: boolean;
  cancelable?: boolean;
  target?: EventTarget;
}

function isDispatchableTarget(target: EventTarget | undefined): target is EventTarget {
  return Boolean(target && typeof (target as EventTarget).dispatchEvent === 'function');
}

export function safeDispatchEvent<T = unknown>(eventName: string, options: SafeDispatchOptions<T> = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const {
    detail,
    bubbles = false,
    cancelable = false,
    target = window,
  } = options;

  if (!isDispatchableTarget(target)) {
    if (import.meta.env?.DEV) {
      console.warn('safeDispatchEvent: target cannot dispatch events', { eventName, target });
    }
    return;
  }

  try {
    if (typeof window.CustomEvent === 'function') {
      target.dispatchEvent(new CustomEvent(eventName, { detail, bubbles, cancelable }));
      return;
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn(`safeDispatchEvent: native CustomEvent dispatch failed for ${eventName}`, error);
    }
  }

  if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
    try {
      const event = document.createEvent('CustomEvent');
      event.initCustomEvent(eventName, bubbles, cancelable, detail as any);
      target.dispatchEvent(event);
      return;
    } catch (fallbackError) {
      if (import.meta.env?.DEV) {
        console.error(`safeDispatchEvent: fallback dispatch failed for ${eventName}`, fallbackError);
      }
    }
  }

  if (import.meta.env?.DEV) {
    console.error(`safeDispatchEvent: unable to dispatch ${eventName}`);
  }
}
