import { ReactNode, useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { useNavigate } from "react-router-dom";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { toast } from "react-toastify";
import OrganizerSidebar from "./OrganizerSidebar";
import OrganizerTopBar from "./OrganizerTopBar";
import OrganizerEventWorkspaceNav from "./OrganizerEventWorkspaceNav";
import { hasRealmRole } from "../../lib/auth";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
} from "../../services/organizerWorkspaceService";
import { userService, UserProfile } from "../../services/userService";

type OrganizerLayoutProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  requireOrganizer?: boolean;
  hideTopBar?: boolean;
  className?: string;
  children: ReactNode;
  showWorkflowNav?: boolean;
  eventId?: string;
};

type OrganizerEventHeaderActionsProps = {
  eventId?: string;
};

function OrganizerEventHeaderActions({ eventId }: OrganizerEventHeaderActionsProps) {
  const navigate = useNavigate();
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setEventDetail(null);
      return;
    }

    let cancelled = false;
    organizerWorkspaceService
      .getMyEvent(eventId)
      .then((event) => {
        if (!cancelled) setEventDetail(event);
      })
      .catch(() => {
        if (!cancelled) setEventDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!eventId) {
    return null;
  }

  if ((eventDetail?.statistics?.ticketsSold ?? 0) > 0) {
    return null;
  }

  const handleCancel = async () => {
    const confirmed = await confirmDestructiveAction({
      title: "Xóa sự kiện này?",
      text: "Sự kiện sẽ bị xóa khỏi workspace organizer và thao tác này không thể hoàn tác.",
      confirmButtonText: "Xóa sự kiện",
      cancelButtonText: "Giữ lại",
    });

    if (!confirmed) return;

    setCancelling(true);
    try {
      await organizerWorkspaceService.deleteEvent(eventId);
      toast.success("Đã xóa sự kiện.");
      navigate("/organizer/events");
    } catch {
      toast.error("Không thể xóa sự kiện lúc này.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="organizer-header-event-actions">
      <button
        type="button"
        className="organizer-header-event-button organizer-header-event-button-cancel"
        onClick={handleCancel}
        disabled={cancelling}
      >
        {cancelling ? "Đang xóa" : "Hủy sự kiện"}
      </button>
    </div>
  );
}

export default function OrganizerLayout({
  title,
  description,
  actions,
  requireOrganizer = true,
  hideTopBar = false,
  className,
  children,
  showWorkflowNav = false,
  eventId,
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
    <div
      className={`organizer-page ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""} ${
        className || ""
      }`}
    >
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
        <main className={`organizer-main organizer-main-full ${showWorkflowNav ? "has-workflow-nav" : ""}`}>
          <header className="organizer-header">
            <div className="organizer-header-title-area">
              <h1 className="organizer-title">{title}</h1>
              {description ? (
                <p className="organizer-description">{description}</p>
              ) : null}
            </div>
            <div className="organizer-header-right">
              {showWorkflowNav ? <OrganizerEventHeaderActions eventId={eventId} /> : null}
              {!hideTopBar ? <OrganizerTopBar /> : null}
              {actions ? (
                <div className="organizer-header-actions">{actions}</div>
              ) : null}
            </div>
          </header>

          {showWorkflowNav ? (
            <OrganizerEventWorkspaceNav eventId={eventId} />
          ) : null}

          <div className="organizer-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
