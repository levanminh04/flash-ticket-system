import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { userService, UserProfile } from "../../services/userService";
import { User, Ticket, ShoppingBag, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const { keycloak } = useKeycloak();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await userService.getProfile();
        if (!cancelled) setProfile(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const displayName =
    profile?.displayName ??
    (profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : keycloak.tokenParsed?.preferred_username ?? "Người dùng");

  const email = profile?.email ?? (keycloak.tokenParsed?.email as string | undefined) ?? "";

  if (!keycloak.authenticated) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <p>Vui lòng đăng nhập để xem hồ sơ.</p>
          <button onClick={() => keycloak.login()} className="btn btn-primary">
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="container">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} />
          Về trang chủ
        </Link>

        <h1 className="profile-page-title">Hồ sơ cá nhân</h1>

        {loading ? (
          <div className="profile-loading">
            <div className="loading-spinner"></div>
            <span>Đang tải...</span>
          </div>
        ) : (
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" />
                ) : (
                  <User size={48} />
                )}
              </div>
              <h2 className="profile-name">{displayName}</h2>
              {email && <p className="profile-email">{email}</p>}
              {profile?.phone && (
                <p className="profile-phone">Điện thoại: {profile.phone}</p>
              )}
              {profile?.roles && profile.roles.length > 0 && (
                <div className="profile-roles">
                  {profile.roles.map((r) => (
                    <span key={r} className="role-badge">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="profile-actions">
              <Link to="/my-tickets" className="profile-action-card">
                <Ticket size={28} />
                <span>Vé của tôi</span>
              </Link>
              <Link to="/my-orders" className="profile-action-card">
                <ShoppingBag size={28} />
                <span>Đơn hàng của tôi</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
