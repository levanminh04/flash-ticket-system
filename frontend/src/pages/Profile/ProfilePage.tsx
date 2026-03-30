import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { userService, UserProfile } from "../../services/userService";
import { Mail, Phone } from "lucide-react";
import AccountSidebar from "../../components/account/AccountSidebar";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";

export default function ProfilePage() {
  const { keycloak } = useKeycloak();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarBroken, setAvatarBroken] = useState(false);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = (
    profile?.displayName ||
    `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
    (keycloak.tokenParsed?.name as string | undefined) ||
    keycloak.tokenParsed?.preferred_username ||
    "Người dùng"
  ).trim();

  const email =
    profile?.email ?? (keycloak.tokenParsed?.email as string | undefined) ?? "";

  const usernameRaw =
    (keycloak.tokenParsed?.preferred_username as string | undefined) ||
    (email.includes("@") ? email.split("@")[0] : "") ||
    displayName.replace(/\s+/g, ".").toLowerCase();

  const username = usernameRaw ? `@${usernameRaw}` : "@guest";

  const defaultAvatarSeed = encodeURIComponent(usernameRaw || "flashticket-user");
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${defaultAvatarSeed}&backgroundColor=f59e0b,c084fc,34d399,60a5fa&fontWeight=700`;
  const avatarSrc = !avatarBroken
    ? profile?.avatarUrl || defaultAvatar
    : defaultAvatar;

  if (!keycloak.authenticated) {
    return (
      <div className="profile-page">
        <AccountCategoryNav />
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
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />

        <div className="account-main-content">
          <h1 className="profile-page-title">Hồ sơ cá nhân</h1>
          {loading ? (
            <div className="profile-loading">
              <div className="loading-spinner"></div>
              <span>Đang tải</span>
            </div>
          ) : (
            <div className="profile-card profile-main-card">
              <div className="profile-header">
                <div className="profile-avatar">
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    onError={() => setAvatarBroken(true)}
                  />
                </div>

                <div className="profile-identity">
                  <h2 className="profile-name">{displayName}</h2>
                  <p className="profile-username">{username}</p>
                </div>

                <div className="profile-contact-grid">
                  <div className="profile-contact-item">
                    <Mail size={16} />
                    <span>{email || "Chưa cập nhật email"}</span>
                  </div>
                  <div className="profile-contact-item">
                    <Phone size={16} />
                    <span>{profile?.phone || "Chưa cập nhật số điện thoại"}</span>
                  </div>
                </div>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
