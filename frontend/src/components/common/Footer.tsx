import { Link } from "react-router-dom";
import { SendHorizontal } from "lucide-react";

const socialLinks = [
  {
    label: "Facebook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/2023_Facebook_icon.svg/960px-2023_Facebook_icon.svg.png",
  },
  {
    label: "Instagram",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/3840px-Instagram_logo_2016.svg.png",
  },
  {
    label: "Telegram",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png",
  },
  {
    label: "YouTube",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/3840px-YouTube_full-color_icon_%282017%29.svg.png",
  },
];

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
              {socialLinks.map((social) => (
                <a
                  href="#"
                  aria-label={social.label}
                  className="home-footer-social"
                  key={social.label}
                >
                  <img src={social.icon} alt="" aria-hidden="true" />
                </a>
              ))}
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
