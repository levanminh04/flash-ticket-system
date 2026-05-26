import { FormEvent, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { LoaderCircle, SendHorizontal, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import Footer from "../../components/common/Footer";
import {
  ApplyOrganizerPayload,
  organizerService,
} from "../../services/organizerService";

const organizerTypes: Array<{
  value: ApplyOrganizerPayload["organizerType"];
  label: string;
}> = [
  { value: "INDIVIDUAL", label: "Cá nhân" },
  { value: "COMPANY", label: "Công ty" },
  { value: "NONPROFIT", label: "Phi lợi nhuận" },
  { value: "GOVERNMENT", label: "Cơ quan nhà nước" },
];

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
  const { keycloak, initialized } = useKeycloak();
  const [form, setForm] = useState<ApplyOrganizerPayload>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSlug, setSubmittedSlug] = useState<string | null>(null);

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
      toast.success("Đã gửi đơn đăng ký nhà tổ chức.");
    } catch {
      toast.error("Không thể gửi đơn đăng ký lúc này.");
    } finally {
      setSubmitting(false);
    }
  };

  if (initialized && !keycloak.authenticated) {
    return (
      <main className="organizer-application-page">
        <section className="organizer-application-state">
          <ShieldCheck size={42} />
          <h1>Đăng ký nhà tổ chức</h1>
          <p>Bạn cần đăng nhập bằng tài khoản buyer trước khi gửi đơn.</p>
          <button className="btn btn-primary" type="button" onClick={() => keycloak.login()}>
            Đăng nhập
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="organizer-application-page">
      <section className="container organizer-application-wrap">
        <div className="organizer-application-header">
          <h1>Đăng ký nhà tổ chức</h1>
          <p>
            Gửi hồ sơ để admin xét duyệt. Sau khi được duyệt, tài khoản sẽ được cấp quyền
            quản lý sự kiện.
          </p>
        </div>

        {submittedSlug ? (
          <section className="organizer-application-success">
            <ShieldCheck size={36} />
            <h2>Đơn đăng ký đã được gửi</h2>
            <p>Hồ sơ đang chờ admin duyệt. Bạn có thể xem trang công khai sau khi hồ sơ được duyệt.</p>
            <Link className="btn btn-secondary" to={`/organizers/${submittedSlug}`}>
              Xem hồ sơ công khai
            </Link>
          </section>
        ) : (
          <form className="organizer-application-form" onSubmit={handleSubmit}>
            <label>
              <span>Tên nhà tổ chức</span>
              <input
                value={form.organizerName}
                onChange={(event) => updateField("organizerName", event.target.value)}
                required
                maxLength={200}
              />
            </label>

            <label>
              <span>Loại hình</span>
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
              <span>Mô tả</span>
              <textarea
                value={form.description || ""}
                onChange={(event) => updateField("description", event.target.value)}
                maxLength={500}
                rows={4}
              />
            </label>

            <label>
              <span>Email liên hệ</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                required
              />
            </label>

            <label>
              <span>Số điện thoại</span>
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
              <span>Mã số thuế</span>
              <input
                value={form.taxCode || ""}
                onChange={(event) => updateField("taxCode", event.target.value)}
              />
            </label>

            <label className="organizer-application-span-2">
              <span>Người đại diện</span>
              <input
                value={form.representativeName || ""}
                onChange={(event) => updateField("representativeName", event.target.value)}
              />
            </label>

            <div className="organizer-application-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle size={16} className="spin" /> : <SendHorizontal size={16} />}
                Gửi đơn đăng ký
              </button>
            </div>
          </form>
        )}
      </section>
      <Footer />
    </main>
  );
}
