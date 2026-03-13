import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
        checkLoginIframe: false,
        pkceMethod: "S256",
        useNonce: false,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Router
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Navbar />
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
              <Route path="/event/:slug" element={<EventDetailPage />} />
              <Route path="/events/:slug/book" element={<SelectTicketPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/payment-result" element={<PaymentResultPage />} />
              <Route path="/payment/result" element={<PaymentResultPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/my-tickets" element={<MyTicketsPage />} />
              <Route path="/my-orders" element={<MyOrdersPage />} />
            </Routes>
          </div>
        </Router>
      </QueryClientProvider>
    </ReactKeycloakProvider>
  );
}

export default App;
