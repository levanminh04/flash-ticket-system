import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./assets/css/global.css";
import "./assets/css/home.css";
import "./assets/css/venues.css";
import "./assets/css/select-ticket.css";
import "./assets/css/checkout.css";
import "./assets/css/payment-result.css";
import "./assets/css/profile-pages.css";
import "./assets/css/event-detail.css";
import "./assets/css/organizer.css";
import "./assets/css/chatbot-widget.css";

const KC_ORIGIN = import.meta.env.VITE_KEYCLOAK_URL as string;

if (KC_ORIGIN) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string" && input.startsWith(KC_ORIGIN)) {
      input = input.replace(KC_ORIGIN, "");
    } else if (input instanceof Request && input.url.startsWith(KC_ORIGIN)) {
      input = new Request(input.url.replace(KC_ORIGIN, ""), input);
    }
    return originalFetch.call(this, input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    if (typeof url === "string" && url.startsWith(KC_ORIGIN)) {
      url = url.replace(KC_ORIGIN, "");
    }
    return (originalOpen as any).call(this, method, url, ...rest);
  };
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(<App />);
