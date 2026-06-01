import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import HomePage from "./pages/Home/HomePage";
import EventSearchPage from "./pages/Search/EventSearchPage";
import EventDetailPage from "./pages/EventDetail/EventDetailPage";
import SelectTicketPage from "./pages/SelectTicket/SelectTicketPage";
import CheckoutPage from "./pages/Checkout/CheckoutPage";
import PaymentResultPage from "./pages/Payment/PaymentResultPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import MyTicketsPage from "./pages/MyTickets/MyTicketsPage";
import MyOrdersPage from "./pages/MyOrders/MyOrdersPage";
import ChatbotPage from "./pages/Chatbot/ChatbotPage";
import VenuesPage from "./pages/Venues/VenuesPage";
import AdminOrganizerReviewPage from "./pages/Admin/AdminOrganizerReviewPage";
import OrganizerApplyPage from "./pages/Organizer/OrganizerApplyPage";
import PublicOrganizerPage from "./pages/Organizer/PublicOrganizerPage";
import OrganizerHubPage from "./pages/Organizer/OrganizerHubPage";
import OrganizerMediaPage from "./pages/Organizer/OrganizerMediaPage";
import OrganizerCheckInPage from "./pages/Organizer/OrganizerCheckInPage";
import OrganizerProfilePage from "./pages/Organizer/OrganizerProfilePage";
import OrganizerEventsPage from "./pages/Organizer/OrganizerEventsPage";
import OrganizerEventEditorPage from "./pages/Organizer/OrganizerEventEditorPage";
import OrganizerTicketTypesPage from "./pages/Organizer/OrganizerTicketTypesPage";
import OrganizerLayoutPage from "./pages/Organizer/OrganizerLayoutPage";
import OrganizerSeatMapPage from "./pages/Organizer/OrganizerSeatMapPage";

import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./lib/keycloak";
import Navbar from "./components/layout/Navbar";
import FloatingChatbot from "./components/chatbot/FloatingChatbot";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const standaloneShellPaths = [
  "/organizer",
  "/organizer/events",
  "/organizer/profile",
  "/organizer/media",
  "/organizer/check-in",
  "/venues",
];

function AppRoutes() {
  const location = useLocation();
  const isTicketSelectionPath = /^\/events\/[^/]+\/book$/.test(location.pathname);
  const usesStandaloneShell = standaloneShellPaths.some(
    (path) =>
      location.pathname === path ||
      (path !== "/venues" && location.pathname.startsWith(`${path}/`)),
  ) || isTicketSelectionPath;

  return (
    <>
      {!usesStandaloneShell ? <Navbar /> : null}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
      <div>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<EventSearchPage />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/event/:slug" element={<EventDetailPage />} />
          <Route path="/organizers/apply" element={<OrganizerApplyPage />} />
          <Route path="/organizers/:slug" element={<PublicOrganizerPage />} />
          <Route path="/admin/organizers" element={<AdminOrganizerReviewPage />} />
          <Route path="/events/:slug/book" element={<SelectTicketPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment-result" element={<PaymentResultPage />} />
          <Route path="/payment/result" element={<PaymentResultPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/my-orders" element={<MyOrdersPage />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route path="/organizer" element={<OrganizerHubPage />} />
          <Route path="/organizer/events" element={<OrganizerEventsPage />} />
          <Route
            path="/organizer/events/new"
            element={<OrganizerEventEditorPage />}
          />
          <Route
            path="/organizer/events/:eventId/edit"
            element={<OrganizerEventEditorPage />}
          />
          <Route
            path="/organizer/events/:eventId/media"
            element={<OrganizerMediaPage />}
          />
          <Route
            path="/organizer/events/:eventId/ticket-types"
            element={<OrganizerTicketTypesPage />}
          />
          <Route
            path="/organizer/events/:eventId/layout"
            element={<OrganizerLayoutPage />}
          />
          <Route
            path="/organizer/events/:eventId/seat-map"
            element={<OrganizerSeatMapPage />}
          />
          <Route
            path="/organizer/profile"
            element={<OrganizerProfilePage />}
          />
          <Route path="/organizer/media" element={<OrganizerMediaPage />} />
          <Route
            path="/organizer/check-in"
            element={<OrganizerCheckInPage />}
          />
        </Routes>
      </div>
      {!usesStandaloneShell ? <FloatingChatbot /> : null}
    </>
  );
}

function App() {
  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={{
        onLoad: "check-sso",
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
        pkceMethod: "S256",
        useNonce: false,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Router
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AppRoutes />
        </Router>
      </QueryClientProvider>
    </ReactKeycloakProvider>
  );
}

export default App;
