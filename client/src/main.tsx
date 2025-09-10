import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Make React globally available to avoid import requirements
(window as any).React = React;

// Suppress harmless ResizeObserver error
const resizeObserverErrorHandler = (e: ErrorEvent) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
    return false;
  }
  return true;
};

window.addEventListener('error', resizeObserverErrorHandler);

createRoot(document.getElementById("root")!).render(<App />);
