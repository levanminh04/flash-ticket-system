import { Link } from "react-router-dom";
import { Facebook, Instagram, SendHorizontal, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer home-footer">
      <div className="container">
        <div className="footer-grid home-footer-grid">
          <div className="footer-col home-footer-brand">
            <Link to="/" className="logo home-footer-logo">
              FlashTicket
            </Link>
            <p>
              Nền tảng đặt vé sự kiện trực tuyến dành cho người mua vé muốn
              giao dịch nhanh và organizer muốn vận hành bán vé trên một giao
              diện rõ ràng.
            </p>
            <div className="home-footer-socials">
              <a href="#" aria-label="Facebook" className="home-footer-social">
                <Facebook size={18} />
              </a>
              <a href="#" aria-label="TikTok" className="home-footer-social">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M15.62 3c.55 1.57 1.78 2.8 3.35 3.35V9.4a6.9 6.9 0 0 1-3.35-.86v6.15a5.62 5.62 0 1 1-5.62-5.62c.3 0 .58.03.86.08v3.1a2.5 2.5 0 1 0 1.64 2.34V3h3.12Z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram" className="home-footer-social">
                <Instagram size={18} />
              </a>
              <a href="#" aria-label="YouTube" className="home-footer-social">
                <Youtube size={18} />
              </a>
            </div>
          </div>
          <div className="footer-col home-footer-subscribe">
            <h4>Get Update Subscribe</h4>
            <h4>Our Newsletter</h4>
            <form className="home-footer-subscribe-form">
              <input
                type="email"
                placeholder="Enter your email address"
                aria-label="Enter your email address"
              />
              <button type="button" aria-label="Send newsletter request">
                <SendHorizontal size={16} />
              </button>
            </form>
          </div>
          <div className="footer-col home-footer-links-group">
            <div className="home-footer-links-columns">
              <div className="footer-col">
                <h4>Quick Links</h4>
                <ul className="footer-links">
                  <li>
                    <Link to="/">Home</Link>
                  </li>
                  <li>
                    <Link to="/search">Events</Link>
                  </li>
                  <li>
                    <Link to="/venues">Venues</Link>
                  </li>
                  <li>
                    <Link to="/organizer">Organizer</Link>
                  </li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>Support</h4>
                <ul className="footer-links">
                  <li>
                    <a href="#home-faq">FAQ</a>
                  </li>
                  <li>
                    <Link to="/profile">My Account</Link>
                  </li>
                  <li>
                    <Link to="/my-orders">Orders</Link>
                  </li>
                  <li>
                    <Link to="/my-tickets">Tickets</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            &copy; 2026 FlashTicket. Event booking homepage for buyers and
            organizers.
          </p>
        </div>
      </div>
    </footer>
  );
}