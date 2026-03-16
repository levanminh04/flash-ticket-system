import { Link } from "react-router-dom";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";

const featureCards = [
  {
    title: "Hồ sơ ban tổ chức",
    description:
      "Xem hồ sơ tổ chức, contact, thông số và trạng thái xác minh",
    href: "/organizer/profile",
  },
  {
    title: "Thư viện ảnh sự kiện",
    description:
      "Upload banner, poster, gallery, thumbnail và sơ đồ chỗ ngồi cho từng event.",
    href: "/organizer/media",
  },
  {
    title: "Check-in vé tại cổng",
    description:
      "Gửi mã QR để xác thực vé, ghi nhận thời gian quét và vị trí cổng.",
    href: "/organizer/check-in",
  },
];

export default function OrganizerHubPage() {
  return (
    <OrganizerLayout
      title="Tổng quan"
      description="Tập hợp các tính năng dành cho ban tổ chức sự kiện"
    >
      <section className="organizer-grid">
        {featureCards.map((card) => (
          <article key={card.href} className="organizer-feature-card">
            <Link to={card.href} className="organizer-feature-title-pill">
              {card.title}
            </Link>
            <p>{card.description}</p>
          </article>
        ))}
      </section>
    </OrganizerLayout>
  );
}
