import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import { eventService } from "../../services/eventService";
import { EventSummary, TicketType } from "../../types/api";
import {
  MapPin,
  Calendar,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Info,
} from "lucide-react";

// ─── Types for local state ───────────────────────────────
interface TicketSelection {
  [ticketTypeId: string]: number;
}

interface SelectedSeat {
  seatId: string;
  ticketTypeId: string;
  seatLabel: string;
  price: number;
}

// Generated seat for client-side seat map
interface GeneratedSeat {
  id: string;
  ticketTypeId: string;
  rowName: string;
  seatNumber: number;
  seatLabel: string;
  status: "AVAILABLE" | "SOLD" | "RESERVED";
  colorCode: string;
  price: number;
}

// ─── Generate seats from ticket types ────────────────────
function generateSeatsFromTicketTypes(ticketTypes: TicketType[]) {
  const sectors: {
    id: string;
    name: string;
    code: string;
    colorCode: string;
    displayOrder: number;
  }[] = [];
  const seats: GeneratedSeat[] = [];
  const SEATS_PER_ROW = 16;

  ticketTypes
    .filter((t) => t.isVisible !== false)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .forEach((tt, ttIdx) => {
      sectors.push({
        id: tt.id,
        name: tt.name,
        code: tt.name.substring(0, 3).toUpperCase(),
        colorCode:
          tt.colorCode ||
          ["#FFD700", "#FFA500", "#4CAF50", "#2196F3", "#9C27B0"][ttIdx % 5],
        displayOrder: tt.displayOrder,
      });

      const totalSeats = Math.min(tt.quantityTotal || 200, 80);
      const soldSeats = Math.round(
        totalSeats *
          ((tt.quantityTotal - tt.quantityAvailable) / tt.quantityTotal),
      );
      const numRows = Math.max(2, Math.ceil(totalSeats / SEATS_PER_ROW));
      const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

      let seatIdx = 0;
      for (let r = 0; r < numRows; r++) {
        const seatsInRow = Math.min(
          SEATS_PER_ROW,
          totalSeats - r * SEATS_PER_ROW,
        );
        if (seatsInRow <= 0) break;

        for (let s = 1; s <= seatsInRow; s++) {
          seatIdx++;
          const isSold = seatIdx <= soldSeats;
          seats.push({
            id: `gen-${tt.id}-${rowLabels[r]}-${s}`,
            ticketTypeId: tt.id,
            rowName: rowLabels[r],
            seatNumber: s,
            seatLabel: `${rowLabels[r]}${s}`,
            status:
              tt.status === "SOLD_OUT" ? "SOLD" : isSold ? "SOLD" : "AVAILABLE",
            colorCode: tt.colorCode || "#4CAF50",
            price: tt.price,
          });
        }
      }
    });

  return { sectors, seats };
}

// ─── Component ───────────────────────────────────────────
export default function SelectTicketPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();

  // Data
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [quantities, setQuantities] = useState<TicketSelection>({});
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);

  // Zoom/Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const generated = useMemo(
    () => generateSeatsFromTicketTypes(ticketTypes),
    [ticketTypes],
  );

  // ─── Fetch data ──────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);

    eventService
      .getEventDetails(slug)
      .then(async (data: any) => {
        setEvent(data);
        const types: TicketType[] = data.ticketTypes || [];
        setTicketTypes(types);

        const initQty: TicketSelection = {};
        types.forEach((t: TicketType) => {
          initQty[t.id] = 0;
        });
        setQuantities(initQty);
        setError(null);
      })
      .catch((err: any) => {
        console.error("Failed to load event:", err);
        setError("Không thể tải thông tin sự kiện.");
        toast.error("Không thể tải thông tin sự kiện.");
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  // ─── Selection logic ─────────────────────────────────────
  const totalSelected =
    Object.values(quantities).reduce((a, b) => a + b, 0) + selectedSeats.length;
  const minPerOrder = (event as any)?.minTicketsPerOrder || 1;
  const maxPerOrder = (event as any)?.maxTicketsPerOrder || 10;

  // Generated seat click
  const handleGenSeatClick = useCallback(
    (seat: GeneratedSeat) => {
      if (seat.status !== "AVAILABLE") return;

      const already = selectedSeats.find((s) => s.seatId === seat.id);
      if (already) {
        setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seat.id));
        setQuantities((prev) => ({
          ...prev,
          [seat.ticketTypeId]: Math.max(0, (prev[seat.ticketTypeId] || 0) - 1),
        }));
        return;
      }
      if (totalSelected >= maxPerOrder) {
        toast.warning(`Bạn chỉ được chọn tối đa ${maxPerOrder} vé.`, {
          toastId: "max-ticket-limit",
        });
        return;
      }

      const tt = ticketTypes.find((t) => t.id === seat.ticketTypeId);
      if (!tt) return;
      if ((quantities[tt.id] || 0) >= tt.quantityAvailable) {
        toast.warning("Loại vé này không còn số lượng phù hợp.", {
          toastId: `ticket-available-${tt.id}`,
        });
        return;
      }

      setSelectedSeats((prev) => [
        ...prev,
        {
          seatId: seat.id,
          ticketTypeId: seat.ticketTypeId,
          seatLabel: seat.seatLabel,
          price: seat.price,
        },
      ]);
      setQuantities((prev) => ({
        ...prev,
        [seat.ticketTypeId]: (prev[seat.ticketTypeId] || 0) + 1,
      }));
    },
    [selectedSeats, totalSelected, maxPerOrder, ticketTypes, quantities],
  );

  // Remove seat tag
  const handleRemoveSeat = useCallback(
    (seatId: string) => {
      const seat = selectedSeats.find((s) => s.seatId === seatId);
      if (!seat) return;
      setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seatId));
      setQuantities((prev) => ({
        ...prev,
        [seat.ticketTypeId]: Math.max(0, (prev[seat.ticketTypeId] || 0) - 1),
      }));
    },
    [selectedSeats],
  );

  // Zoom/Pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(3, Math.max(0.5, prev - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ─── Submit ──────────────────────────────────────────────
  const handleContinue = () => {
    if (totalSelected < minPerOrder) {
      toast.warning(`Vui lòng chọn ít nhất ${minPerOrder} vé.`);
      return;
    }

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    const selectedSeatSnapshot = selectedSeats.map((seat) => ({
      seatId: seat.seatId,
      ticketTypeId: seat.ticketTypeId,
      seatLabel: seat.seatLabel,
    }));

    sessionStorage.setItem("bookingItems", JSON.stringify(items));
    sessionStorage.setItem("bookingEvent", JSON.stringify(event));
    sessionStorage.setItem("bookingTicketTypes", JSON.stringify(ticketTypes));
    sessionStorage.setItem(
      "bookingSelectedSeats",
      JSON.stringify(selectedSeatSnapshot),
    );

    if (!keycloak?.authenticated) {
      keycloak?.login({
        redirectUri: `${window.location.origin}/checkout`,
      });
      return;
    }

    navigate("/checkout");
  };

  // ─── Computed ────────────────────────────────────────────
  const subtotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const bannerUrl =
    (event as any)?.images?.find((i: any) => i.type === "BANNER")?.url ||
    (event as any)?.bannerUrl;
  const startStr =
    (event as any)?.schedule?.startDatetime ||
    (event as any)?.startDatetime ||
    (event as any)?.startTime;
  const startDate = startStr ? new Date(startStr) : null;
  const venueName =
    (event as any)?.venue?.name || (event as any)?.venueName || "";
  const venueAddress =
    (event as any)?.venue?.address || (event as any)?.venueAddress || "";

  // Group seats
  const genSeatsBySector: Record<string, GeneratedSeat[]> = {};
  generated.seats.forEach((gs) => {
    if (!genSeatsBySector[gs.ticketTypeId])
      genSeatsBySector[gs.ticketTypeId] = [];
    genSeatsBySector[gs.ticketTypeId].push(gs);
  });

  // ─── Loading / Error ────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Đang tải thông tin vé...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ textAlign: "center", padding: "100px", color: "red" }}>
        <p>{error || "Không tìm thấy sự kiện"}</p>
        <Link
          to="/"
          style={{ textDecoration: "underline", color: "var(--primary)" }}
        >
          Quay về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="select-ticket-page">
      {/* HEADER */}
      <div className="booking-focus-header">
        <div className="container">
          <div className="focus-event-info">
            {bannerUrl && (
              <img src={bannerUrl} alt="" className="event-thumb" />
            )}
            <div>
              <div className="event-name">{event.title}</div>
              {startDate && (
                <div className="event-date">
                  {startDate.toLocaleDateString("vi-VN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="step-indicator">
            <div className="step-item active">
              <span className="step-number">1</span>
              <span>Chọn vé</span>
            </div>
            <div className="step-divider" />
            <div className="step-item">
              <span className="step-number">2</span>
              <span>Thanh toán</span>
            </div>
            <div className="step-divider" />
            <div className="step-item">
              <span className="step-number">3</span>
              <span>Kết quả</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="container">
        <div className="select-ticket-layout">
          {/* ════════════ LEFT: SEAT MAP ════════════ */}
          <div className="seat-map-section">
            <div className="section-header">
              <h2>Sơ đồ chỗ ngồi</h2>
              <span className="hint">
                Click ghế · Cuộn zoom · Kéo di chuyển
              </span>
            </div>

            <div className="seat-map-container">
              <div
                className="seat-map-viewport"
                ref={mapRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className="seat-map-content"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                  {/* Stage */}
                  <div className="stage-indicator">
                    <div className="stage-box">SÂN KHẤU</div>
                  </div>

                  {/* Generated Seats */}
                  {generated.sectors.map((sector) => {
                    const seatsIn = genSeatsBySector[sector.id] || [];
                    const rows: Record<string, GeneratedSeat[]> = {};
                    seatsIn.forEach((gs) => {
                      if (!rows[gs.rowName]) rows[gs.rowName] = [];
                      rows[gs.rowName].push(gs);
                    });

                    return (
                      <div
                        key={sector.id}
                        className="sector-block"
                        style={{ borderColor: sector.colorCode || "#cbd5e1" }}
                      >
                        <div
                          className="sector-label"
                          style={{
                            backgroundColor: sector.colorCode || "#94a3b8",
                          }}
                        >
                          {sector.name} ({sector.code})
                        </div>

                        {Object.entries(rows)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([rowName, seats]) => (
                            <div key={rowName} className="seat-row">
                              <span className="seat-row-label">{rowName}</span>
                              {seats
                                .sort((a, b) => a.seatNumber - b.seatNumber)
                                .map((gs) => {
                                  const isSelected = selectedSeats.some(
                                    (s) => s.seatId === gs.id,
                                  );
                                  let cls = gs.status.toLowerCase();
                                  if (isSelected) cls = "selected";
                                  return (
                                    <div
                                      key={gs.id}
                                      className={`seat ${cls}`}
                                      onClick={() => handleGenSeatClick(gs)}
                                      title={`${gs.seatLabel} - ${sector.name}`}
                                      style={{
                                        ...(gs.status === "AVAILABLE" &&
                                        !isSelected
                                          ? {
                                              background: `${sector.colorCode}30`,
                                              borderColor: `${sector.colorCode}80`,
                                              color: sector.colorCode,
                                            }
                                          : {}),
                                      }}
                                    >
                                      {gs.seatNumber}
                                    </div>
                                  );
                                })}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom: Legend + Zoom */}
            <div className="seat-map-bottom">
              <div className="seat-legend">
                <div className="legend-item">
                  <div
                    className="legend-dot"
                    style={{
                      background: "#d1fae5",
                      border: "2px solid #a7f3d0",
                    }}
                  />
                  Trống
                </div>
                <div className="legend-item">
                  <div
                    className="legend-dot"
                    style={{
                      background: "var(--primary)",
                      border: "2px solid var(--primary-dark)",
                    }}
                  />
                  Đang chọn
                </div>
                <div className="legend-item">
                  <div
                    className="legend-dot"
                    style={{
                      background: "#fef3c7",
                      border: "2px solid #fde68a",
                    }}
                  />
                  Đã giữ
                </div>
                <div className="legend-item">
                  <div
                    className="legend-dot"
                    style={{
                      background: "#e2e8f0",
                      border: "2px solid #cbd5e1",
                    }}
                  />
                  Đã bán
                </div>
              </div>

              <div className="zoom-controls">
                <button
                  className="zoom-btn"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  className="zoom-btn"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  <ZoomOut size={14} />
                </button>
                <button className="zoom-btn" onClick={resetView}>
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ════════════ RIGHT: SIDEBAR ════════════ */}
          <div className="booking-sidebar">
            {/* Event Card */}
            <div className="sidebar-event-card">
              {bannerUrl && (
                <img
                  src={bannerUrl}
                  alt={event.title}
                  className="event-poster"
                />
              )}
              <div className="event-details">
                <div className="event-title">{event.title}</div>

                {startDate && (
                  <div className="event-meta-row">
                    <Calendar size={14} />
                    <span>
                      {startDate.toLocaleDateString("vi-VN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {" · "}
                      {startDate.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}

                {(venueName || venueAddress) && (
                  <div className="event-meta-row">
                    <MapPin size={14} />
                    <span>
                      {venueName}
                      {venueAddress ? `, ${venueAddress}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="sidebar-tiers">
              <h3>Hạng vé</h3>
              {ticketTypes
                .filter((t) => t.isVisible !== false)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((tt) => {
                  const isSoldOut =
                    tt.status === "SOLD_OUT" || tt.quantityAvailable === 0;
                  const hasSelection = (quantities[tt.id] || 0) > 0;

                  return (
                    <div
                      key={tt.id}
                      className={`tier-item ${isSoldOut ? "sold-out" : ""} ${hasSelection ? "active" : ""}`}
                    >
                      <div className="tier-left">
                        <span
                          className="tier-dot"
                          style={{
                            backgroundColor:
                              tt.colorCode || "var(--text-muted)",
                          }}
                        />
                        <span className="tier-name">{tt.name}</span>
                      </div>
                      <span className="tier-price">
                        {isSoldOut
                          ? "Hết vé"
                          : `${tt.price.toLocaleString("vi-VN")} đ`}
                      </span>
                    </div>
                  );
                })}

              <div className="ticket-notice" style={{ marginTop: 12 }}>
                <Info size={14} />
                <span>
                  Tối thiểu {minPerOrder}, tối đa {maxPerOrder} vé
                </span>
              </div>
            </div>

            {/* Selected Seats */}
            <div className="sidebar-selected">
              <div className="selected-header">
                <span className="label">Đã chọn</span>
                {selectedSeats.length > 0 && (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {selectedSeats.length} ghế
                  </span>
                )}
              </div>

              {selectedSeats.length === 0 ? (
                <div className="selected-empty">Chưa chọn ghế nào</div>
              ) : (
                <div className="selected-seats-list">
                  {selectedSeats.map((s) => (
                    <span key={s.seatId} className="selected-seat-tag">
                      {s.seatLabel}
                      <span
                        className="remove-seat"
                        onClick={() => handleRemoveSeat(s.seatId)}
                      >
                        <X size={12} />
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Action Button inside Selected */}
              <div className="sidebar-action-embedded">
                {selectedSeats.length === 0 ? (
                  <button className="action-btn disabled-state" disabled>
                    Vui lòng lựa chọn ghế
                  </button>
                ) : (
                  <button
                    className="action-btn active-state"
                    onClick={handleContinue}
                    disabled={totalSelected < minPerOrder}
                  >
                    <span className="btn-label">{"Thanh toán ngay"}</span>
                    <span className="btn-total">
                      {subtotal.toLocaleString("vi-VN")} đ
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
