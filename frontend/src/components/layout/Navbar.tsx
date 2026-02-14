// File: src/components/layout/Navbar.tsx
import { useKeycloak } from "@react-keycloak/web";
import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Đang kết nối Keycloak</div>;
  }

  return (
    <header className="bg-[#2DC275] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-white font-bold text-2xl"
        >
          <Ticket size={28} />
          <span>FlashTicket</span>
        </Link>

        <nav>
          {!keycloak.authenticated ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => keycloak.login()}
                className="bg-white text-[#2DC275] px-6 py-2 rounded-full font-medium hover:bg-gray-100 transition shadow-sm"
              >
                Đăng nhập
              </button>
              <button
                onClick={() => keycloak.register()}
                className="bg-white text-[#2DC275] px-6 py-2 rounded-full font-medium hover:bg-gray-100 transition shadow-sm"
              >
                Đăng ký
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="font-medium text-white">
                Xin chào, {keycloak.tokenParsed?.preferred_username}
              </span>
              <button
                onClick={() => keycloak.logout()}
                className="text-white/80 hover:text-white font-medium transition"
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
