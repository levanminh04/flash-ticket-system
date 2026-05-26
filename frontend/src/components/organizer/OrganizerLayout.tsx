import { ReactNode, useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import OrganizerSidebar from "./OrganizerSidebar";
import OrganizerTopBar from "./OrganizerTopBar";
import { hasRealmRole } from "../../lib/auth";
import { userService, UserProfile } from "../../services/userService";

type OrganizerLayoutProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  requireOrganizer?: boolean;
  hideTopBar?: boolean;
  children: ReactNode;
};

export default function OrganizerLayout({
  title,
  description,
  actions,
  requireOrganizer = true,
  hideTopBar = false,
  children,
}: OrganizerLayoutProps) {
  const { keycloak, initialized } = useKeycloak();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("organizer_sidebar_collapsed") === "true";
  });
  const hasOrganizerTokenRole = hasRealmRole(keycloak.tokenParsed, "ORGANIZER");
  const hasOrganizerProfileRole = Boolean(
    profile?.roles?.some((role) => role.toUpperCase() === "ORGANIZER"),
  );

  useEffect(() => {
    if (!initialized || !keycloak.authenticated || hasOrganizerTokenRole) return;

    userService
      .getProfile()
      .then((data) => setProfile(data))
      .catch(() => setProfile(null));
  }, [hasOrganizerTokenRole, initialized, keycloak.authenticated]);

  const refreshLoginSession = () => {
    void keycloak.login({
      redirectUri: window.location.href,
      prompt: "login",
    });
  };

  if (!initialized) {
    return (
      <div className="organizer-page organizer-loading-page">
        <div className="organizer-page-loading" role="status" aria-live="polite">
          <LoaderCircle className="organizer-loading-icon" size={32} />
          <h1>Loading Page</h1>
          <p>Vui lòng chờ trong giây lát, hệ thống đang chuẩn bị workspace.</p>
        </div>
      </div>
    );
  }

  if (requireOrganizer && !keycloak.authenticated) {
    return (
      <div className="organizer-page organizer-state-page">
        <div className="container organizer-state-card">
          <ShieldAlert size={28} />
          <h1>Đăng nhập để dùng organizer workspace</h1>
          <p>Các API upload ảnh và check-in yêu cầu JWT có quyền organizer.</p>
          <button className="btn btn-primary" onClick={() => keycloak.login()}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (requireOrganizer && !hasOrganizerTokenRole) {
    return (
      <div className="organizer-page organizer-state-page">
        <div className="container organizer-state-card">
          <ShieldAlert size={28} />
          <h1>
            {hasOrganizerProfileRole
              ? "Cần cập nhật phiên đăng nhập"
              : "Tài khoản hiện tại chưa có quyền organizer"}
          </h1>
          <p>
            {hasOrganizerProfileRole
              ? "Hồ sơ của bạn đã được duyệt, nhưng token đăng nhập hiện tại vẫn chưa có role ORGANIZER. Hãy đăng nhập lại để lấy quyền mới."
              : "Hồ sơ organizer của bạn chưa được admin duyệt hoặc token chưa có role ORGANIZER."}
          </p>
          {hasOrganizerProfileRole ? (
            <button className="btn btn-primary" type="button" onClick={refreshLoginSession}>
              Cập nhật phiên đăng nhập
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`organizer-page ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <OrganizerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() =>
          setIsSidebarCollapsed((value) => {
            const nextValue = !value;
            localStorage.setItem("organizer_sidebar_collapsed", String(nextValue));
            return nextValue;
          })
        }
      />

      <div className="organizer-layout">
        <main className="organizer-main organizer-main-full">
          <header className="organizer-header">
            <div>
              <h1 className="organizer-title">{title}</h1>
              <p className="organizer-description">{description}</p>
            </div>
            <div className="organizer-header-right">
              {!hideTopBar ? <OrganizerTopBar /> : null}
              {actions ? (
                <div className="organizer-header-actions">{actions}</div>
              ) : null}
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
