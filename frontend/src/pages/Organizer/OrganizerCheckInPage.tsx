import { FormEvent, useState } from "react";
import { toast } from "react-toastify";
import {
  BadgeCheck,
  LoaderCircle,
  QrCode,
  ShieldAlert,
} from "lucide-react";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  organizerService,
  CheckInResponse,
} from "../../services/organizerService";

type CheckInHistoryItem = CheckInResponse & {
  scannedLocation: string;
  scannedAt: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function OrganizerCheckInPage() {
  const [qrData, setQrData] = useState("");
  const [location, setLocation] = useState("Cổng chính");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckInHistoryItem | null>(null);
  const [history, setHistory] = useState<CheckInHistoryItem[]>([]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQrData = qrData.trim();
    const trimmedLocation = location.trim();

    if (!trimmedQrData) {
      toast.error("Nhập hoặc quét QR data trước khi check-in.");
      return;
    }
    if (!trimmedLocation) {
      toast.error("Nhập vị trí cổng check-in.");
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
      toast.success("Check-in thành công.");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        "Check-in thất bại. Kiểm tra QR data hoặc quyền organizer.";
      toast.error(String(message));
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OrganizerLayout
      title="Check-in vé"
      description="Dành cho quầy soát vé hoặc máy quét QR. Chỉ cần quét hoặc dán mã QR theo định dạng hệ thống yêu cầu"
    >
      <section className="organizer-grid organizer-grid-checkin">
        <form className="organizer-panel organizer-checkin-form" onSubmit={handleSubmit}>
          <div className="organizer-panel-heading">
            <h2>Máy quét / nhập tay</h2>
            <p>
              Nếu bạn dùng máy quét 2D kiểu bàn phím, hãy đặt con trỏ vào ô QR
              data rồi quét trực tiếp.
            </p>
          </div>

          <label className="organizer-field">
            <span>QR data</span>
            <textarea
              value={qrData}
              onChange={(changeEvent) => setQrData(changeEvent.target.value)}
              className="organizer-input organizer-textarea"
              placeholder="Dán hoặc quét chuỗi QR data của vé tại đây"
              rows={7}
            />
          </label>

          <label className="organizer-field">
            <span>Điểm check-in</span>
            <input
              value={location}
              onChange={(changeEvent) => setLocation(changeEvent.target.value)}
              className="organizer-input"
              placeholder="Ví dụ: Cổng A, Bàn VIP, Khu backstage"
            />
          </label>

          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <QrCode size={16} />
            )}
            Xác nhận check-in
          </button>
        </form>

        <div className="organizer-stack">
          <section className="organizer-panel organizer-result-panel">
            <div className="organizer-panel-heading">
              <h2>Kết quả lần quét gần nhất</h2>
            </div>

            {result ? (
              <div className="organizer-checkin-result success">
                <div className="organizer-checkin-result-icon">
                  <BadgeCheck size={24} />
                </div>
                <div className="organizer-checkin-result-copy">
                  <h3>{result.holderName}</h3>
                  <p>{result.ticketTypeName}</p>
                </div>

                <div className="organizer-checkin-data">
                  <div>
                    <span>Mã vé</span>
                    <strong>{result.ticketCode}</strong>
                  </div>
                  <div>
                    <span>Ghế / khu</span>
                    <strong>{result.seatLabel}</strong>
                  </div>
                  <div>
                    <span>Check-in lúc</span>
                    <strong>{formatDateTime(result.checkedInAt)}</strong>
                  </div>
                  <div>
                    <span>Vị trí quét</span>
                    <strong>{result.scannedLocation}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="organizer-empty-state">
                <ShieldAlert size={28} />
                <p>Chưa có lần quét nào trong phiên làm việc này.</p>
              </div>
            )}
          </section>

          <section className="organizer-panel">
            <div className="organizer-panel-heading">
              <h2>Lịch sử phiên hiện tại</h2>
            </div>

            {history.length === 0 ? (
              <div className="organizer-empty-state compact">
                <QrCode size={24} />
                <p>Chưa có lịch sử check-in.</p>
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
                      <span>{formatDateTime(item.scannedAt)}</span>
                    </div>
                    <div className="organizer-history-meta">
                      <span>{item.ticketCode}</span>
                      <span>{item.ticketTypeName}</span>
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
