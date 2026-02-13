// File: src/components/layout/Navbar.tsx
import { useKeycloak } from '@react-keycloak/web';
import { Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Đang kết nối Keycloak...</div>;
  }

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-blue-600 font-bold text-2xl">
          <Ticket size={28} />
          <span>TicketBox</span>
        </Link>

        <nav>
          {!keycloak.authenticated ? (
            <button 
              onClick={() => keycloak.login()}
              className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700 transition"
            >
              Đăng nhập
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700">
                Xin chào, {keycloak.tokenParsed?.preferred_username}
              </span>
              <button 
                onClick={() => keycloak.logout()}
                className="text-gray-500 hover:text-red-500 font-medium"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;