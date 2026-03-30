import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import OrganizerEventWorkspaceNav from "../../components/organizer/OrganizerEventWorkspaceNav";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
  OrganizerSeatMap,
} from "../../services/organizerWorkspaceService";
import { summarizeSeatMap } from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

function buildSeatBadgeClass(status?: string) {
  switch (status) {
    case "SOLD":
      return "is-danger";
    case "LOCKED":
      return "is-warning";
    case "RESERVED":
      return "is-muted";
    default:
      return "is-success";
  }
}

export default function OrganizerSeatMapPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { ready } = useOrganizerGate();
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(null);
  const [seatMap, setSeatMap] = useState<OrganizerSeatMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const load = async () => {
      if (!eventId) return;

      setLoading(true);
      try {
        const [nextEvent, nextSeatMap] = await Promise.all([
          organizerWorkspaceService.getMyEvent(eventId),
          organizerWorkspaceService.getSeatMap(eventId),
        ]);

        if (!cancelled) {
          setEventDetail(nextEvent);
          setSeatMap(nextSeatMap);
        }
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải seat map của sự kiện.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId, ready]);

  const summary = summarizeSeatMap(seatMap);

  return (
    <OrganizerLayout
      title="Seat map"
      description="Màn hình read-only để xem cấu trúc layout, sectors và trạng thái ghế hiện đang được API trả về."
    >
      {eventId ? <OrganizerEventWorkspaceNav eventId={eventId} /> : null}

      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải seat map</p>
        </section>
      ) : !seatMap ? (
        <section className="organizer-panel organizer-empty-state">
          <p>
            Event này chưa có seat map khả dụng từ API. Hãy tạo layout trước hoặc kiểm
            tra dữ liệu sectors/seats trong backend.
          </p>
        </section>
      ) : (
        <>
          <section className="organizer-panel organizer-toolbar-panel">
            <div className="organizer-panel-heading-row">
              <div>
                <p className="organizer-panel-title-pill">Seat map overview</p>
                <h2>{eventDetail?.title || "Sự kiện chưa xác định"}</h2>
                <p>Ảnh nền, sectors và seats bên dưới đều đang đọc từ API thật.</p>
              </div>
              <div className="organizer-chip-row">
                <span className="organizer-chip">{summary.sectorCount} sector</span>
                <span className="organizer-chip">{summary.seatCount} ghế</span>
                <span className="organizer-chip">{summary.soldSeatCount} đã bán</span>
              </div>
            </div>
          </section>

          <section className="organizer-grid organizer-grid-wide">
            <section className="organizer-panel">
              <div className="organizer-panel-heading">
                <h2>Ảnh nền layout</h2>
              </div>

              {seatMap.backgroundImageUrl ? (
                <div className="organizer-layout-preview">
                  <img src={seatMap.backgroundImageUrl} alt="Seat map background" />
                </div>
              ) : (
                <div className="organizer-empty-state compact">
                  <p>Seat map chưa có ảnh nền.</p>
                </div>
              )}

              <div className="organizer-card-metadata">
                <span>Width: {seatMap.backgroundWidth ?? "-"}</span>
                <span>Height: {seatMap.backgroundHeight ?? "-"}</span>
                <span>Khóa ghế: {summary.lockedSeatCount}</span>
                <span>Reserved: {summary.reservedSeatCount}</span>
              </div>
            </section>

            <section className="organizer-panel">
              <div className="organizer-panel-heading">
                <h2>Sectors và seats</h2>
              </div>

              {!seatMap.sectors?.length ? (
                <div className="organizer-empty-state compact">
                  <p>
                    API seat map đã lên, nhưng hiện chưa có sectors/seats thực trong dữ
                    liệu trả về.
                  </p>
                </div>
              ) : (
                <div className="organizer-list-stack">
                  {seatMap.sectors.map((sector) => (
                    <article key={sector.id} className="organizer-list-card">
                      <div className="organizer-list-card-header">
                        <div>
                          <h3>{sector.name}</h3>
                          <p>{sector.sectorType || "Không rõ loại sector"}</p>
                        </div>
                        <div className="organizer-chip-row">
                          <span className="organizer-chip">
                            {sector.seatsData?.length ?? 0} ghế
                          </span>
                          {sector.colorCode ? (
                            <span
                              className="organizer-chip"
                              style={{ borderColor: sector.colorCode }}
                            >
                              {sector.colorCode}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="organizer-seat-grid">
                        {(sector.seatsData || []).map((seat) => (
                          <div key={seat.id} className="organizer-seat-cell">
                            <span
                              className={`organizer-status-badge ${buildSeatBadgeClass(
                                seat.inventoryStatus,
                              )}`}
                            >
                              {seat.inventoryStatus || "AVAILABLE"}
                            </span>
                            <strong>{seat.seatLabel || seat.seatNumber || seat.id}</strong>
                            <small>{seat.rowName || "N/A"}</small>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}
