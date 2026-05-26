import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKeycloak } from "@react-keycloak/web";
import { useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { hasRealmRole } from "../../lib/auth";
import { OrganizerProfile, organizerService } from "../../services/organizerService";

const statusOptions = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"];
const statusLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  ACTIVE: "Đã duyệt",
  REJECTED: "Đã từ chối",
  SUSPENDED: "Tạm khóa",
};

export default function AdminOrganizerReviewPage() {
  const { keycloak, initialized } = useKeycloak();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const isAdmin = hasRealmRole(keycloak.tokenParsed, "ADMIN");

  const organizersQuery = useQuery({
    queryKey: ["admin-organizers", status],
    queryFn: () => organizerService.getAdminOrganizers(status, 0, 20),
    enabled: initialized && keycloak.authenticated && isAdmin,
  });

  const verifyMutation = useMutation({
    mutationFn: ({
      organizerProfileId,
      approved,
      rejectionReason,
    }: {
      organizerProfileId: string;
      approved: boolean;
      rejectionReason?: string;
    }) =>
      organizerService.verifyOrganizer(organizerProfileId, {
        approved,
        rejectionReason: rejectionReason?.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái hồ sơ organizer.");
      void queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
    },
    onError: () => {
      toast.error("Không thể cập nhật hồ sơ organizer.");
    },
  });

  const rejectOrganizer = async (profile: OrganizerProfile) => {
    const { value: rejectionReason } = await Swal.fire({
      title: "Từ chối hồ sơ",
      input: "textarea",
      inputLabel: "Lý do từ chối",
      inputPlaceholder: "Nhập lý do từ chối tại đây...",
      showCancelButton: true,
      confirmButtonText: "Xác nhận từ chối",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "Bạn cần nhập lý do từ chối!";
        }
        return null;
      },
    });

    if (rejectionReason) {
      verifyMutation.mutate({
        organizerProfileId: profile.id,
        approved: false,
        rejectionReason: rejectionReason.trim(),
      });
    }
  };

  if (initialized && (!keycloak.authenticated || !isAdmin)) {
    return (
      <main className="admin-organizer-page">
        <section className="admin-organizer-state">
          <ShieldAlert size={42} />
          <h1>Không có quyền truy cập</h1>
          <p>Chỉ tài khoản admin mới được duyệt hồ sơ nhà tổ chức.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-organizer-page">
      <section className="container admin-organizer-wrap">
        <div className="admin-organizer-header">
          <div>
            <h1>Duyệt đăng ký organizer</h1>
            <p>Kiểm tra hồ sơ buyer gửi lên và approve hoặc reject quyền organizer.</p>
          </div>

          <label>
            <span>Trạng thái</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option] || option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {organizersQuery.isLoading ? (
          <div className="admin-organizer-loading">
            <LoaderCircle size={20} className="spin" />
            Đang tải danh sách hồ sơ...
          </div>
        ) : (
          <div className="admin-organizer-table-wrap">
            <table className="admin-organizer-table">
              <thead>
                <tr>
                  <th>Tên ban tổ chức</th>
                  <th>Slug</th>
                  <th>SĐT</th>
                  <th>Email</th>
                  <th>Kênh công khai</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(organizersQuery.data?.content || []).map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <strong>{profile.name}</strong>
                    </td>
                    <td>
                      <span>{profile.slug ? `/${profile.slug}` : "Chưa có slug"}</span>
                    </td>
                    <td>
                      <span>{profile.phone || "Chưa có số điện thoại"}</span>
                    </td>
                    <td>
                      <span>{profile.email || "Chưa có email"}</span>
                    </td>
                    <td>
                      {profile.websiteUrl ? (
                        <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
                          {profile.websiteUrl}
                        </a>
                      ) : (
                        <span>Chưa có website</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-organizer-actions">
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={verifyMutation.isPending || status !== "PENDING"}
                          onClick={() =>
                            verifyMutation.mutate({
                              organizerProfileId: profile.id,
                              approved: true,
                            })
                          }
                        >
                          <CheckCircle2 size={16} />
                          Duyệt
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={verifyMutation.isPending || status !== "PENDING"}
                          onClick={() => rejectOrganizer(profile)}
                        >
                          <XCircle size={16} />
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {organizersQuery.data?.content?.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Không có hồ sơ ở trạng thái này.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
