export interface SafeDispatchOptions<T = unknown> {
  detail?: T;
  bubbles?: boolean;
  cancelable?: boolean;
  target?: EventTarget;
}

function isDispatchableTarget(target: EventTarget | undefined): target is EventTarget {
  return Boolean(target && typeof (target as EventTarget).dispatchEvent === 'function');
}

function createCustomEvent<T>(
  eventName: string,
  detail: T | undefined,
  bubbles: boolean,
  cancelable: boolean,
): Event | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const eventInit: CustomEventInit<T> = { detail, bubbles, cancelable };

  if (typeof window.CustomEvent === 'function') {
    try {
      return new window.CustomEvent<T>(eventName, eventInit);
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn(`safeDispatchEvent: CustomEvent constructor failed for ${eventName}`, error);
      }
    }
  }

  if (typeof window.Event === 'function') {
    try {
      const basicEvent = new window.Event(eventName, { bubbles, cancelable });

      if (detail !== undefined) {
        Object.defineProperty(basicEvent, 'detail', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: detail,
        });
      }

      return basicEvent;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn(`safeDispatchEvent: Event constructor failed for ${eventName}`, error);
      }
    }
  }

  if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
    try {
      const eventType = detail !== undefined ? 'CustomEvent' : 'Event';
      const legacyEvent = document.createEvent(eventType);

      if ('initCustomEvent' in legacyEvent) {
        (legacyEvent as CustomEvent<T>).initCustomEvent(eventName, bubbles, cancelable, detail as T);
      } else if ('initEvent' in legacyEvent) {
        legacyEvent.initEvent(eventName, bubbles, cancelable);
        if (detail !== undefined) {
          Object.assign(legacyEvent as unknown as { detail?: T }, { detail });
        }
      }

      return legacyEvent;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.error(`safeDispatchEvent: document.createEvent failed for ${eventName}`, error);
      }
    }
  }

  return null;
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

  const event = createCustomEvent(eventName, detail, bubbles, cancelable);

  if (!event) {
    if (import.meta.env?.DEV) {
      console.error(`safeDispatchEvent: unable to create event for ${eventName}`);
    }
    return;
  }

  try {
    target.dispatchEvent(event);
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.error(`safeDispatchEvent: dispatch failed for ${eventName}`, error);
    }
  }
}
