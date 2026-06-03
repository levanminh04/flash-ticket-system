import { FormEvent, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { LoaderCircle, SendHorizontal, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Footer from "../../components/common/Footer";
import {
  ApplyOrganizerPayload,
  organizerService,
} from "../../services/organizerService";

const initialForm: ApplyOrganizerPayload = {
  organizerName: "",
  organizerType: "INDIVIDUAL",
  description: "",
  websiteUrl: "",
  contactEmail: "",
  contactPhone: "",
  taxCode: "",
  representativeName: "",
};

export default function OrganizerApplyPage() {
  const { t } = useTranslation();
  const { keycloak, initialized } = useKeycloak();
  const [form, setForm] = useState<ApplyOrganizerPayload>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSlug, setSubmittedSlug] = useState<string | null>(null);

  const organizerTypes = useMemo<Array<{
    value: ApplyOrganizerPayload["organizerType"];
    label: string;
  }>>(
    () => [
      { value: "INDIVIDUAL", label: t("organizer.individual") },
      { value: "COMPANY", label: t("organizer.company") },
      { value: "NONPROFIT", label: t("organizer.nonprofit") },
      { value: "GOVERNMENT", label: t("organizer.government") },
    ],
    [t],
  );

  const updateField = <TKey extends keyof ApplyOrganizerPayload>(
    key: TKey,
    value: ApplyOrganizerPayload[TKey],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const profile = await organizerService.applyForOrganizer({
        ...form,
        description: form.description?.trim() || null,
        websiteUrl: form.websiteUrl?.trim() || null,
        taxCode: form.taxCode?.trim() || null,
        representativeName: form.representativeName?.trim() || null,
      });
      setSubmittedSlug(profile.slug || null);
      toast.success(t("organizer.applySuccess"));
    } catch {
      toast.error(t("organizer.applyFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (initialized && !keycloak.authenticated) {
    return (
      <main className="organizer-application-page">
        <section className="organizer-application-state">
          <ShieldCheck size={42} />
          <h1>{t("organizer.applyTitle")}</h1>
          <p>{t("organizer.applyLoginRequired")}</p>
          <button className="btn btn-primary" type="button" onClick={() => keycloak.login()}>
            {t("auth.signIn")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="organizer-application-page">
      <section className="container organizer-application-wrap">
        <div className="organizer-application-header">
          <h1>{t("organizer.applyTitle")}</h1>
          <p>{t("organizer.applyDescription")}</p>
        </div>

        {submittedSlug ? (
          <section className="organizer-application-success">
            <ShieldCheck size={36} />
            <h2>{t("organizer.submittedTitle")}</h2>
            <p>{t("organizer.submittedDescription")}</p>
            <Link className="btn btn-secondary" to={`/organizers/${submittedSlug}`}>
              {t("organizer.viewPublicProfile")}
            </Link>
          </section>
        ) : (
          <form className="organizer-application-form" onSubmit={handleSubmit}>
            <label>
              <span>{t("organizer.name")}</span>
              <input
                value={form.organizerName}
                onChange={(event) => updateField("organizerName", event.target.value)}
                required
                maxLength={200}
              />
            </label>

            <label>
              <span>{t("organizer.organizerType")}</span>
              <select
                value={form.organizerType}
                onChange={(event) =>
                  updateField(
                    "organizerType",
                    event.target.value as ApplyOrganizerPayload["organizerType"],
                  )
                }
              >
                {organizerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="organizer-application-span-2">
              <span>{t("organizer.description")}</span>
              <textarea
                value={form.description || ""}
                onChange={(event) => updateField("description", event.target.value)}
                maxLength={500}
                rows={4}
              />
            </label>

            <label>
              <span>{t("organizer.contactEmail")}</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                required
              />
            </label>

            <label>
              <span>{t("profile.phone")}</span>
              <input
                value={form.contactPhone}
                onChange={(event) => updateField("contactPhone", event.target.value)}
                required
                placeholder="0901234567"
              />
            </label>

            <label>
              <span>Website</span>
              <input
                value={form.websiteUrl || ""}
                onChange={(event) => updateField("websiteUrl", event.target.value)}
                placeholder="https://example.com"
              />
            </label>

            <label>
              <span>{t("organizer.taxCode")}</span>
              <input
                value={form.taxCode || ""}
                onChange={(event) => updateField("taxCode", event.target.value)}
              />
            </label>

            <label className="organizer-application-span-2">
              <span>{t("organizer.representative")}</span>
              <input
                value={form.representativeName || ""}
                onChange={(event) => updateField("representativeName", event.target.value)}
              />
            </label>

            <div className="organizer-application-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle size={16} className="spin" /> : <SendHorizontal size={16} />}
                {t("organizer.submitApplication")}
              </button>
            </div>
          </form>
        )}
      </section>
      <Footer />
    </main>
  );
}
