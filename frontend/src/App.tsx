import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./lib/keycloak";
import Navbar from "./components/layout/Navbar";
import AdminLayout from "./components/layout/AdminLayout";
import HomePage from "./pages/Home/HomePage";
import Dashboard from "./pages/Admin/Dashboard";
import UserManagement from "./pages/Admin/UserManagement";
import OrganizerManagement from "./pages/Admin/OrganizerManagement";
import EventManagement from "./pages/Admin/EventManagement";
import OrderManagement from "./pages/Admin/OrderManagement";
import PromotionManagement from "./pages/Admin/PromotionManagement";
import AiManagement from "./pages/Admin/AiManagement";
import EventDetailPage from "./pages/Event/EventDetailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
const PublicLayout = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen">
        <Outlet />
      </div>
    </>
  );
};

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
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="organizers" element={<OrganizerManagement />} />
              <Route path="events" element={<EventManagement />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="promotions" element={<PromotionManagement />} />
              <Route path="ai" element={<AiManagement />} />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </ReactKeycloakProvider>
  );
}

export default App;
