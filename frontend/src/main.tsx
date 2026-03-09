import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import keycloak from "./lib/keycloak";
import "./index.css";
import "./assets/css/global.css";
import "./assets/css/home.css";
import "./assets/css/select-ticket.css";
import "./assets/css/checkout.css";
import "./assets/css/payment-result.css";
import "./assets/css/profile-pages.css";

// Proxy keycloak-js network requests (token exchange, refresh) through
// the Vite dev-server so they become same-origin and bypass CORS.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalOpen as any).call(this, method, url, ...rest);
  };
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <div style={{ textAlign: "center", padding: "100px" }}>
    <p>Đang khởi tạo...</p>
  </div>,
);

keycloak
  .init({ checkLoginIframe: false, pkceMethod: "S256", useNonce: false })
  .then((authenticated) => {
    console.log("[Keycloak] Init OK — authenticated:", authenticated);
    if (authenticated) {
      console.log("[Keycloak] Token:", keycloak.token?.substring(0, 30) + "...");
    }

    keycloak.init = () => {
      setTimeout(() => {
        keycloak.onReady?.(keycloak.authenticated ?? false);
        if (keycloak.authenticated) keycloak.onAuthSuccess?.();
      }, 0);
      return Promise.resolve(keycloak.authenticated ?? false);
    };

    root.render(<App />);
  })
  .catch((err) => {
    console.error("[Keycloak] Init FAILED:", err);

    keycloak.init = () => {
      setTimeout(() => keycloak.onReady?.(false), 0);
      return Promise.resolve(false);
    };

    root.render(<App />);
  });
