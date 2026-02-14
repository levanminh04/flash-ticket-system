import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import HomePage from "./pages/Home/HomePage";

import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./lib/keycloak";
import Navbar from "./components/layout/Navbar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        onLoad: "check-sso",
        silentCheckSsoRedirectUri:
          window.location.origin + "/silent-check-sso.html",
        checkLoginIframe: false,
        pkceMethod: "S256",
      }}
      onEvent={(event, error) => {
        if (event === "onAuthError")
          console.error("Keycloak Auth Error:", error);
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Router
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Navbar />
          <div>
            <Routes>
              <Route path="/" element={<HomePage />} />
            </Routes>
          </div>
        </Router>
      </QueryClientProvider>
    </ReactKeycloakProvider>
  );
}

export default App;
