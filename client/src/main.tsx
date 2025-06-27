import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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
