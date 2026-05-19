import { ReactNode } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import OrganizerSidebar from "./OrganizerSidebar";
import { hasRealmRole } from "../../lib/auth";

type OrganizerLayoutProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function OrganizerLayout({
  title,
  description,
  actions,
  children,
}: OrganizerLayoutProps) {
  const { keycloak, initialized } = useKeycloak();

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

  if (!keycloak.authenticated) {
    return (
      <div className="organizer-page">
        <div className="container organizer-state-card">
          <ShieldAlert size={28} />
          <h1>Đăng nhập để dùng organizer workspace</h1>
          <p>
            Các API upload ảnh và check-in yêu cầu JWT có quyền organizer.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => keycloak.login()}
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (!hasRealmRole(keycloak.tokenParsed, "ORGANIZER")) {
    return (
      <div className="organizer-page">
        <div className="container organizer-state-card">
          <ShieldAlert size={28} />
          <h1>Tài khoản hiện tại chưa có quyền organizer</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="organizer-page">
      <OrganizerSidebar />

      <div className="container organizer-layout">
        <main className="organizer-main organizer-main-full">
          <header className="organizer-header">
            <div>
              <h1 className="organizer-title">{title}</h1>
              <p className="organizer-description">{description}</p>
            </div>
            {actions ? (
              <div className="organizer-header-actions">{actions}</div>
            ) : null}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
