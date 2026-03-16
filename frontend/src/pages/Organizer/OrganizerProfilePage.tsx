import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import {
  BadgeCheck,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  organizerService,
  OrganizerProfile,
} from "../../services/organizerService";

function formatRating(value?: number | null) {
  if (value == null) return "-";
  return Number(value).toFixed(1);
}

function statNumber(value?: number | null) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

export default function OrganizerProfilePage() {
  const { keycloak } = useKeycloak();
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = keycloak.tokenParsed?.sub as string | undefined;
    if (!keycloak.authenticated || !userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await organizerService.getOrganizerByUserId(userId);
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) {
          setProfile(null);
          setError("Không thể tải hồ sơ ban tổ chức.");
          toast.error("Không thể tải hồ sơ ban tổ chức.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [keycloak.authenticated, keycloak.tokenParsed]);

  return (
    <OrganizerLayout
      title="Hồ sơ ban tổ chức"
      description="Hệ thống lấy thông tin ban tổ chức dựa trên tài khoản người dùng hiện tại."
    >
      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải hồ sơ ban tổ chức</p>
        </section>
      ) : error || !profile ? (
        <section className="organizer-panel organizer-empty-state">
          <ShieldCheck size={28} />
          <p>{error || "Không tìm thấy hồ sơ ban tổ chức"}</p>
        </section>
      ) : (
        <>
          <section className="organizer-profile-hero">
            <div className="organizer-profile-banner">
              {profile.bannerUrl ? (
                <img src={profile.bannerUrl} alt={profile.name} />
              ) : (
                <div className="organizer-profile-banner-fallback" />
              )}
            </div>

            <div className="organizer-profile-card">
              <div className="organizer-profile-avatar">
                {profile.logoUrl ? (
                  <img src={profile.logoUrl} alt={profile.name} />
                ) : (
                  <span>{profile.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="organizer-profile-copy">
                <div className="organizer-profile-heading">
                  <div>
                    <div className="organizer-identity-row">
                      <h2>{profile.name}</h2>
                      {profile.isVerified ? (
                        <span className="organizer-verified-pill">
                          <BadgeCheck size={14} />
                          Đã xác minh
                        </span>
                      ) : null}
                    </div>
                    <p className="organizer-profile-slug">
                      {profile.slug ? `@${profile.slug}` : "Organizer chưa có slug"}
                    </p>
                  </div>
                </div>

                <p className="organizer-profile-description">
                  {profile.description || "Organizer chưa cập nhật mô tả."}
                </p>

                <div className="organizer-contact-grid">
                  <div className="organizer-contact-item">
                    <Mail size={16} />
                    <span>{profile.email || "Chưa cập nhật email"}</span>
                  </div>
                  <div className="organizer-contact-item">
                    <Phone size={16} />
                    <span>{profile.phone || "Chưa cập nhật số điện thoại"}</span>
                  </div>
                  <div className="organizer-contact-item">
                    <Globe size={16} />
                    <span>{profile.websiteUrl || "Chưa cập nhật website"}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="organizer-grid">
            <article className="organizer-panel organizer-stat-panel">
              <div className="organizer-panel-heading">
                <h2>Chỉ số hiện có</h2>
                <p>
                  Các số liệu này đến trực tiếp từ `OrganizerDTO` trong user-service.
                </p>
              </div>

              <div className="organizer-stats-grid">
                <div className="organizer-stat-card">
                  <span className="organizer-stat-label">Tổng sự kiện</span>
                  <strong>{statNumber(profile.totalEvents)}</strong>
                </div>
                <div className="organizer-stat-card">
                  <span className="organizer-stat-label">Vé đã bán</span>
                  <strong>{statNumber(profile.totalTicketsSold)}</strong>
                </div>
                <div className="organizer-stat-card">
                  <span className="organizer-stat-label">Người theo dõi</span>
                  <strong>{statNumber(profile.followerCount)}</strong>
                </div>
                <div className="organizer-stat-card">
                  <span className="organizer-stat-label">Đánh giá trung bình</span>
                  <strong>{formatRating(profile.averageRating)}</strong>
                </div>
              </div>
            </article>

            <article className="organizer-panel">
              <div className="organizer-panel-heading">
                <h2>Thông tin định danh</h2>
                <p>Hữu ích để kiểm tra mapping user hiện tại với organizer profile.</p>
              </div>

              <div className="organizer-profile-meta-list">
                <div className="organizer-profile-meta-row">
                  <span>Organizer ID</span>
                  <strong>{profile.id}</strong>
                </div>
                <div className="organizer-profile-meta-row">
                  <span>User ID</span>
                  <strong>{profile.userId}</strong>
                </div>
                <div className="organizer-profile-meta-row">
                  <span>Trạng thái xác minh</span>
                  <strong>{profile.isVerified ? "Verified" : "Pending"}</strong>
                </div>
              </div>

              <div className="organizer-inline-note">
                <Users size={18} />
                <span>
                  Page này hiện chỉ đọc dữ liệu. Backend chưa có API cập nhật organizer
                  profile nên tôi không thêm form chỉnh sửa.
                </span>
              </div>

              <div className="organizer-inline-note">
                <Star size={18} />
                <span>
                  Khi backend có API update hoặc dashboard organizer, phần này có thể
                  mở rộng tiếp mà không cần đổi route hiện tại.
                </span>
              </div>
            </article>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}
