import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKeycloak } from "@react-keycloak/web";
import { useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { useTranslation } from "react-i18next";
import { hasRealmRole } from "../../lib/auth";
import { OrganizerProfile, organizerService } from "../../services/organizerService";

const statusOptions = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"];

export default function AdminOrganizerReviewPage() {
  const { t } = useTranslation();
  const { keycloak, initialized } = useKeycloak();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const isAdmin = hasRealmRole(keycloak.tokenParsed, "ADMIN");

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      PENDING: t("adminOrganizer.statusPending"),
      ACTIVE: t("adminOrganizer.statusActive"),
      REJECTED: t("adminOrganizer.statusRejected"),
      SUSPENDED: t("adminOrganizer.statusSuspended"),
    }),
    [t],
  );

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
      toast.success(t("adminOrganizer.updateSuccess"));
      void queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
    },
    onError: () => {
      toast.error(t("adminOrganizer.updateFailed"));
    },
  });

  const rejectOrganizer = async (profile: OrganizerProfile) => {
    const { value: rejectionReason } = await Swal.fire({
      title: t("adminOrganizer.rejectTitle"),
      input: "textarea",
      inputLabel: t("adminOrganizer.rejectReason"),
      inputPlaceholder: t("adminOrganizer.rejectPlaceholder"),
      showCancelButton: true,
      confirmButtonText: t("adminOrganizer.rejectConfirm"),
      cancelButtonText: t("adminOrganizer.rejectCancel"),
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return t("adminOrganizer.rejectRequired");
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
          <h1>{t("adminOrganizer.noAccessTitle")}</h1>
          <p>{t("adminOrganizer.noAccessDescription")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-organizer-page">
      <section className="container admin-organizer-wrap">
        <div className="admin-organizer-header">
          <div>
            <h1>{t("adminOrganizer.headerTitle")}</h1>
            <p>{t("adminOrganizer.headerDescription")}</p>
          </div>

          <label>
            <span>{t("adminOrganizer.status")}</span>
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
            {t("adminOrganizer.loading")}
          </div>
        ) : (
          <div className="admin-organizer-table-wrap">
            <table className="admin-organizer-table">
              <thead>
                <tr>
                  <th>{t("adminOrganizer.tableName")}</th>
                  <th>Slug</th>
                  <th>{t("profile.phone")}</th>
                  <th>Email</th>
                  <th>{t("adminOrganizer.publicChannel")}</th>
                  <th>{t("adminOrganizer.tableActions")}</th>
                </tr>
              </thead>
              <tbody>
                {(organizersQuery.data?.content || []).map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <strong>{profile.name}</strong>
                    </td>
                    <td>
                      <span>{profile.slug ? `/${profile.slug}` : t("adminOrganizer.slugMissing")}</span>
                    </td>
                    <td>
                      <span>{profile.phone || t("adminOrganizer.phoneMissing")}</span>
                    </td>
                    <td>
                      <span>{profile.email || t("adminOrganizer.emailMissing")}</span>
                    </td>
                    <td>
                      {profile.websiteUrl ? (
                        <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
                          {profile.websiteUrl}
                        </a>
                      ) : (
                        <span>{t("adminOrganizer.websiteMissing")}</span>
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
                          {t("adminOrganizer.approve")}
                        </button>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={verifyMutation.isPending || status !== "PENDING"}
                          onClick={() => rejectOrganizer(profile)}
                        >
                          <XCircle size={16} />
                          {t("adminOrganizer.reject")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {organizersQuery.data?.content?.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{t("adminOrganizer.noRows")}</td>
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
