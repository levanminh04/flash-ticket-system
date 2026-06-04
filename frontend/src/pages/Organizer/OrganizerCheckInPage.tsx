import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LoaderCircle, QrCode, ShieldAlert } from "lucide-react";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  organizerService,
  CheckInResponse,
} from "../../services/organizerService";

type CheckInHistoryItem = CheckInResponse & {
  scannedLocation: string;
  scannedAt: string;
};

function formatDateTime(value: string | null | undefined, language: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "en" ? "en-US" : "vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function OrganizerCheckInPage() {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const [qrData, setQrData] = useState("");
  const [location, setLocation] = useState(() => t("checkIn.defaultLocation"));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckInHistoryItem | null>(null);
  const [history, setHistory] = useState<CheckInHistoryItem[]>([]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQrData = qrData.trim();
    const trimmedLocation = location.trim();

    if (!trimmedQrData) {
      toast.error(t("checkIn.qrRequired"));
      return;
    }
    if (trimmedQrData.length > 1000) {
      toast.error(t("checkIn.qrTooLong"));
      return;
    }
    if (!trimmedLocation) {
      toast.error(t("checkIn.locationRequired"));
      return;
    }
    if (trimmedLocation.length > 100) {
      toast.error(t("checkIn.locationTooLong"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await organizerService.checkInTicket(
        trimmedQrData,
        trimmedLocation,
      );
      const historyItem: CheckInHistoryItem = {
        ...response,
        scannedLocation: trimmedLocation,
        scannedAt: new Date().toISOString(),
      };

      setResult(historyItem);
      setHistory((current) => [historyItem, ...current].slice(0, 8));
      setQrData("");
      toast.success(t("checkIn.success"));
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        t("checkIn.failed");
      toast.error(String(message));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OrganizerLayout
      title={t("checkIn.title")}
      description={t("checkIn.description")}
      className="organizer-check-in-page"
    >
      <section className="organizer-grid organizer-grid-checkin">
        <form
          className="organizer-panel organizer-checkin-form"
          onSubmit={handleSubmit}
        >
          <label className="organizer-field">
            <span>{t("checkIn.qrData")}</span>
            <textarea
              value={qrData}
              onChange={(changeEvent) => setQrData(changeEvent.target.value)}
              className="organizer-input organizer-textarea"
              placeholder={t("checkIn.qrPlaceholder")}
              rows={1}
            />
          </label>

          <label className="organizer-field">
            <span>{t("checkIn.location")}</span>
            <input
              value={location}
              onChange={(changeEvent) => setLocation(changeEvent.target.value)}
              className="organizer-input"
              placeholder={t("checkIn.locationPlaceholder")}
            />
          </label>

          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <QrCode size={16} />
            )}
            {t("checkIn.confirm")}
          </button>
        </form>

        <div className="organizer-stack">
          <section className="organizer-panel organizer-result-panel">
            <div className="organizer-panel-heading">
              <h2>{t("checkIn.latestResult")}</h2>
            </div>

            {result ? (
              <div className="organizer-checkin-result success">
                <div className="organizer-checkin-result-copy">
                  <h3>
                    <strong>{t("checkIn.holderName")}: </strong>
                    {result.holderName}
                  </h3>
                  <p>
                    <strong>{t("checkIn.ticketType")}: </strong>
                    {result.ticketTypeName}
                  </p>
                </div>

                <div
                  className="organizer-checkin-data"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px 12px",
                  }}
                >
                  <div style={{ minWidth: "auto" }}>
                    <span>{t("checkIn.ticketCode")}</span>
                    <strong>{result.ticketCode}</strong>
                  </div>
                  <div style={{ minWidth: "auto", paddingLeft: "40px" }}>
                    <span>{t("checkIn.seat")}</span>
                    <strong>{result.seatLabel}</strong>
                  </div>
                  <div style={{ minWidth: "auto" }}>
                    <span>{t("checkIn.checkedInAt")}</span>
                    <strong>{formatDateTime(result.checkedInAt, language)}</strong>
                  </div>
                  <div style={{ minWidth: "auto", paddingLeft: "40px" }}>
                    <span>{t("checkIn.scannedLocation")}</span>
                    <strong>{result.scannedLocation}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="organizer-empty-state">
                <ShieldAlert size={28} />
                <p>{t("checkIn.emptySession")}</p>
              </div>
            )}
          </section>

          <section className="organizer-panel">
            <div className="organizer-panel-heading">
              <h2>{t("checkIn.currentHistory")}</h2>
            </div>

            {history.length === 0 ? (
              <div className="organizer-empty-state compact">
                <QrCode size={24} />
                <p>{t("checkIn.emptyHistory")}</p>
              </div>
            ) : (
              <div className="organizer-history-list">
                {history.map((item) => (
                  <article
                    key={`${item.ticketCode}-${item.scannedAt}`}
                    className="organizer-history-card"
                  >
                    <div className="organizer-history-header">
                      <strong>{item.holderName}</strong>
                      <span>{formatDateTime(item.scannedAt, language)}</span>
                    </div>
                    <div className="organizer-history-meta">
                      <span>{item.ticketCode} | </span>
                      <span>{item.ticketTypeName} | </span>
                      <span>{item.scannedLocation}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </OrganizerLayout>
  );
}
