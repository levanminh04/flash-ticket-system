// File: src/App.tsx
import { ReactKeycloakProvider } from '@react-keycloak/web';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import keycloak from './lib/keycloak';
import HomePage from './pages/Home/HomePage';

function App() {
  return (
    <ReactKeycloakProvider 
      authClient={keycloak}
      initOptions={{ onLoad: 'check-sso' }} // Tự động check xem user đã login chưa
    >
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          {/* Header (Navbar) sẽ nằm ở đây */}
          
          <main>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              
              {/* Các route tiếp theo sẽ thêm vào đây: 
                  <Route path="/events/:id" element={<EventDetailPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} /> 
              */}
            </Routes>
          </main>

          {/* Footer sẽ nằm ở đây */}
        </div>
      </BrowserRouter>
    </ReactKeycloakProvider>
  );
}

export default App;