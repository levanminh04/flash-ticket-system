import { Link } from "react-router-dom";
import { SendHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  return (
    <footer className="footer home-footer">
      <div className="container">
        <div className="footer-grid home-footer-grid">
          <div className="footer-col home-footer-brand">
            <Link to="/" className="logo home-footer-logo">
              FlashTicket
            </Link>
            <p>{t("footer.brandDescription")}</p>
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
            <h4>{t("footer.newsletterFirstLine")}</h4>
            <h4>{t("footer.newsletterSecondLine")}</h4>
            <form className="home-footer-subscribe-form">
              <input
                type="email"
                placeholder={t("footer.subscribePlaceholder")}
                aria-label={t("footer.subscribePlaceholder")}
              />
              <button type="button" aria-label={t("footer.newsletterFirstLine")}>
                <SendHorizontal size={16} />
              </button>
            </form>
          </div>
          <div className="footer-col home-footer-links-group">
            <div className="home-footer-links-columns">
              <div className="footer-col">
                <h4>{t("footer.quickLinks")}</h4>
                <ul className="footer-links">
                  <li>
                    <Link to="/">{t("nav.home")}</Link>
                  </li>
                  <li>
                    <Link to="/search">{t("nav.events")}</Link>
                  </li>
                  <li>
                    <Link to="/venues">{t("nav.venues")}</Link>
                  </li>
                  <li>
                    <Link to="/organizer">{t("nav.organizer")}</Link>
                  </li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>{t("footer.support")}</h4>
                <ul className="footer-links">
                  <li>
                    <a href="#home-faq">FAQ</a>
                  </li>
                  <li>
                    <Link to="/profile">{t("nav.myAccount")}</Link>
                  </li>
                  <li>
                    <Link to="/my-orders">{t("nav.orders")}</Link>
                  </li>
                  <li>
                    <Link to="/my-tickets">{t("nav.tickets")}</Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
