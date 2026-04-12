import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import {
  BadgeCheck,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
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
  if (value == null) return "-";
  return Number(value).toLocaleString("vi-VN");
}

export default function OrganizerProfilePage() {
  const { keycloak } = useKeycloak();
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!keycloak.authenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await organizerService.getMyOrganizerProfile();
        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setError("Không thể tải hồ sơ ban tổ chức.");
          toast.error("Không thể tải hồ sơ ban tổ chức.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [keycloak.authenticated]);

  return (
    <OrganizerLayout
      title="Hồ sơ ban tổ chức"
      description="Trang này lấy dữ liệu trực tiếp từ API organizer profile hiện có của hệ thống."
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
                <div className="organizer-profile-info">
                  <div className="organizer-profile-field">
                    <span className="organizer-profile-field-label">
                      Tên ban tổ chức:
                    </span>
                    <div className="organizer-profile-field-value organizer-profile-field-value--title">
                      <h2>{profile.name}</h2>
                    </div>
                  </div>

                  {profile.isVerified ? (
                    <div className="organizer-identity-row">
                      <span className="organizer-verified-pill">
                        <BadgeCheck size={14} />
                        Đã xác minh
                      </span>
                    </div>
                  ) : null}

                  <div className="organizer-profile-field organizer-profile-slug">
                    <span className="organizer-profile-field-label organizer-profile-slug-label">
                      Slug:
                    </span>
                    <span className="organizer-profile-field-value organizer-profile-field-value--title">
                      {profile.slug ? `${profile.slug}` : "Organizer chưa có slug"}
                    </span>
                  </div>

                  <div className="organizer-profile-field organizer-profile-description">
                    <span className="organizer-profile-field-label">Mô tả:</span>
                    <span className="organizer-profile-field-value">
                      {profile.description || "Organizer chưa cập nhật mô tả."}
                    </span>
                  </div>
                </div>

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
                <p className="organizer-panel-title-pill">Chỉ số hiện có</p>
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
                <p className="organizer-panel-title-pill">Thông tin định danh</p>
              </div>

              <div className="organizer-profile-meta-list">
                <div className="organizer-profile-meta-row">
                  <strong>Organizer ID</strong>
                  <span className="organizer-profile-meta-value">{profile.id}</span>
                </div>
                <div className="organizer-profile-meta-row">
                  <strong>User ID</strong>
                  <span className="organizer-profile-meta-value">{profile.userId}</span>
                </div>
                <div className="organizer-profile-meta-row">
                  <strong>Trạng thái xác minh</strong>
                  <span className="organizer-profile-meta-value">
                    {profile.isVerified == null
                      ? "Unknown"
                      : profile.isVerified
                        ? "Verified"
                        : "Pending"}
                  </span>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}
