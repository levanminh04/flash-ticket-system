import { ReactKeycloakProvider } from '@react-keycloak/web';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import keycloak from './lib/keycloak';
import HomePage from './pages/Home/HomePage';
import Navbar from './components/layout/Navbar'; 

function App() {
  return (
    <ReactKeycloakProvider 
      authClient={keycloak}
      initOptions={{ onLoad: 'check-sso' }}
      LoadingComponent={
        <div className="min-h-screen flex items-center justify-center bg-white text-gray-800 text-xl font-bold">
          Đang tải hệ thống TicketBox
        </div>
      }
    >
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <Navbar />
          
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ReactKeycloakProvider>
  );
}

export default App;