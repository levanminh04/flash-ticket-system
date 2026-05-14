import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import { eventService } from "../../services/eventService";
import { EventSummary, PublicSeat, PublicSeatMap, PublicSeatSector, TicketType } from "../../types/api";
import BookingStepIndicator from "../../components/common/BookingStepIndicator";
import BuyerSeatMapCanvas from "../../components/seat-map/runtime/BuyerSeatMapCanvas";
import {
  MapPin,
  Calendar,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Info,
} from "lucide-react";

interface TicketSelection {
  [ticketTypeId: string]: number;
}

interface SelectedSeat {
  seatId: string;
  ticketTypeId: string;
  seatLabel: string;
  price: number;
}

function getTicketTypeSectorId(ticketType: TicketType) {
  return ticketType.eventSectorId || ticketType.sectorId || "";
}

function getSectorTicketTypeId(sector: PublicSeatSector) {
  const mapData = sector.mapData ?? {};
  return typeof mapData.ticketTypeId === "string" ? mapData.ticketTypeId : "";
}

export default function SelectTicketPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [seatMap, setSeatMap] = useState<PublicSeatMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantities, setQuantities] = useState<TicketSelection>({});
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);

  const [zoom, setZoom] = useState(0.40);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!slug) {
      return;
    }

    setIsLoading(true);

    Promise.all([eventService.getEventDetails(slug), eventService.getSeatMap(slug)])
      .then(([data, nextSeatMap]) => {
        setEvent(data);
        const types: TicketType[] = data.ticketTypes || [];
        setTicketTypes(types);
        setSeatMap(nextSeatMap);

        const initQty: TicketSelection = {};
        types.forEach((ticketType: TicketType) => {
          initQty[ticketType.id] = 0;
        });
        setQuantities(initQty);
        setError(null);
      })
      .catch((err: any) => {
        console.error("Failed to load event or seat map:", err);
        setError("Vui long tai lai trang");
        toast.error("Khong the tai thong tin su kien.");
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  const totalSelected = Object.values(quantities).reduce((a, b) => a + b, 0);
  const minPerOrder = (event as any)?.config?.minTicketsPerOrder || (event as any)?.minTicketsPerOrder || 1;
  const maxPerOrder = (event as any)?.config?.maxTicketsPerOrder || (event as any)?.maxTicketsPerOrder || 10;

  const ticketTypeBySectorId = useMemo(() => {
    const mapping = new Map<string, TicketType>();
    ticketTypes.forEach((ticketType) => {
      const sectorId = getTicketTypeSectorId(ticketType);
      if (sectorId) {
        mapping.set(sectorId, ticketType);
      }
    });
    return mapping;
  }, [ticketTypes]);

  const ticketTypeById = useMemo(() => {
    const mapping = new Map<string, TicketType>();
    ticketTypes.forEach((ticketType) => {
      mapping.set(ticketType.id, ticketType);
    });
    return mapping;
  }, [ticketTypes]);

  const availableSeatCount = useMemo(
    () =>
      (seatMap?.sectors ?? []).reduce(
        (total, sector) =>
          total +
          (sector.seatsData ?? []).filter(
            (seat) => seat.isActive !== false && seat.inventoryStatus === "AVAILABLE",
          ).length,
        0,
      ),
    [seatMap],
  );

  const handleSeatClick = useCallback(
    (sector: PublicSeatSector, seat: PublicSeat) => {
      if (seat.isActive === false || seat.inventoryStatus !== "AVAILABLE") {
        return;
      }

      const ticketType =
        ticketTypeBySectorId.get(sector.id) ||
        ticketTypeById.get(getSectorTicketTypeId(sector));
      if (!ticketType) {
        toast.warning("Sector nay chua duoc gan loai ve.");
        return;
      }

      const already = selectedSeats.find((selectedSeat) => selectedSeat.seatId === seat.id);
      if (already) {
        setSelectedSeats((prev) => prev.filter((selectedSeat) => selectedSeat.seatId !== seat.id));
        setQuantities((prev) => ({
          ...prev,
          [ticketType.id]: Math.max(0, (prev[ticketType.id] || 0) - 1),
        }));
        return;
      }

      if (totalSelected >= maxPerOrder) {
        toast.warning(`Ban chi duoc chon toi da ${maxPerOrder} ve.`, {
          toastId: "max-ticket-limit",
        });
        return;
      }

      if ((quantities[ticketType.id] || 0) >= (ticketType.quantityAvailable || 0)) {
        toast.warning("Loai ve nay khong con so luong phu hop.", {
          toastId: `ticket-available-${ticketType.id}`,
        });
        return;
      }

      const displayLabel = sector.mapData?.code && seat.seatLabel
        ? `${String(sector.mapData.code)}-${seat.seatLabel}`
        : seat.seatLabel || `${seat.rowName || ""}${seat.seatNumber || ""}`;

      setSelectedSeats((prev) => [
        ...prev,
        {
          seatId: seat.id,
          ticketTypeId: ticketType.id,
          seatLabel: displayLabel,
          price: Number(ticketType.price || 0),
        },
      ]);
      setQuantities((prev) => ({
        ...prev,
        [ticketType.id]: (prev[ticketType.id] || 0) + 1,
      }));
    },
    [maxPerOrder, quantities, selectedSeats, ticketTypeById, ticketTypeBySectorId, totalSelected],
  );

  const handleRemoveSeat = useCallback(
    (seatId: string) => {
      const seat = selectedSeats.find((selectedSeat) => selectedSeat.seatId === seatId);
      if (!seat) {
        return;
      }

      setSelectedSeats((prev) => prev.filter((selectedSeat) => selectedSeat.seatId !== seatId));
      setQuantities((prev) => ({
        ...prev,
        [seat.ticketTypeId]: Math.max(0, (prev[seat.ticketTypeId] || 0) - 1),
      }));
    },
    [selectedSeats],
  );

  const resetView = () => {
    setZoom(0.35);
    setPan({ x: 0, y: 0 });
  };

  const handleContinue = () => {
    if (totalSelected < minPerOrder) {
      toast.warning(`Vui long chon it nhat ${minPerOrder} ve.`);
      return;
    }

    const items = Array.from(
      selectedSeats.reduce<
        Map<string, { ticketTypeId: string; quantity: number; seatIds: string[] }>
      >((acc, seat) => {
        const current = acc.get(seat.ticketTypeId);
        if (current) {
          current.quantity += 1;
          current.seatIds.push(seat.seatId);
          return acc;
        }

        acc.set(seat.ticketTypeId, {
          ticketTypeId: seat.ticketTypeId,
          quantity: 1,
          seatIds: [seat.seatId],
        });
        return acc;
      }, new Map()).values(),
    );
    const selectedSeatSnapshot = selectedSeats.map((seat) => ({
      seatId: seat.seatId,
      ticketTypeId: seat.ticketTypeId,
      seatLabel: seat.seatLabel,
    }));

    sessionStorage.setItem("bookingItems", JSON.stringify(items));
    sessionStorage.setItem("bookingEvent", JSON.stringify(event));
    sessionStorage.setItem("bookingTicketTypes", JSON.stringify(ticketTypes));
    sessionStorage.setItem("bookingSelectedSeats", JSON.stringify(selectedSeatSnapshot));

    if (!keycloak?.authenticated) {
      keycloak?.login({
        redirectUri: `${window.location.origin}/checkout`,
      });
      return;
    }

    navigate("/checkout");
  };

  const subtotal = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  const bannerUrl =
    (event as any)?.images?.find((i: any) => i.type === "BANNER")?.url ||
    (event as any)?.bannerUrl;
  const startStr =
    (event as any)?.schedule?.startDatetime ||
    (event as any)?.startDatetime ||
    (event as any)?.startTime;
  const startDate = startStr ? new Date(startStr) : null;
  const venueName = (event as any)?.venue?.name || (event as any)?.venueName || "";
  const venueAddress = (event as any)?.venue?.address || (event as any)?.venueAddress || "";

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Dang tai thong tin ve</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ textAlign: "center", padding: "100px", color: "red" }}>
        <p>{error || "Khong tim thay su kien"}</p>
        <Link
          to="/"
          style={{ textDecoration: "underline", color: "var(--primary)" }}
        >
          Quay ve trang chu
        </Link>
      </div>
    );
  }

  return (
    <div className="select-ticket-page">
      <div className="booking-focus-header">
        <div className="container">
          <div className="focus-breadcrumb" aria-label="Breadcrumb">
            <Link to="/" className="breadcrumb-home">
              Home
            </Link>
            <span className="breadcrumb-separator">/</span>
            <Link to={`/event/${slug || ""}`} className="breadcrumb-event">
              Event
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{event.title}</span>
          </div>

          <BookingStepIndicator currentStep={1} />
        </div>
      </div>

      <div className="container">
        <div className="select-ticket-layout">
          <div className="seat-map-section">
            <div className="section-header">
              <h2>Sơ đồ chỗ ngồi</h2>
              <span className="hint">Click ghế để chọn</span>
            </div>

            <div className="seat-map-container">
              {seatMap ? (
                <BuyerSeatMapCanvas
                  seatMap={seatMap}
                  zoom={zoom}
                  pan={pan}
                  selectedSeatIds={selectedSeats.map((seat) => seat.seatId)}
                  onPanChange={setPan}
                  onZoomChange={setZoom}
                  onSeatClick={handleSeatClick}
                />
              ) : (
                <div className="buyer-seat-map-empty">
                  <p>Sự kiện này chưa có sơ đồ chỗ ngồi được publish</p>
                </div>
              )}
            </div>

            <div className="seat-map-bottom">
              <div className="seat-legend">
                <div className="legend-item">
                  <div className="legend-dot legend-dot-available" />
                  Trong
                </div>
                <div className="legend-item">
                  <div className="legend-dot legend-dot-selected" />
                  Dang chon
                </div>
                <div className="legend-item">
                  <div className="legend-dot legend-dot-reserved" />
                  Da giu
                </div>
                <div className="legend-item">
                  <div className="legend-dot legend-dot-sold" />
                  Da ban
                </div>
              </div>

              <div className="zoom-controls">
                <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                  <ZoomIn size={14} />
                </button>
                <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))}>
                  <ZoomOut size={14} />
                </button>
                <button className="zoom-btn" onClick={resetView}>
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="booking-sidebar">
            <div className="sidebar-event-card">
              {bannerUrl && (
                <img src={bannerUrl} alt={event.title} className="event-poster" />
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

            <div className="sidebar-tiers">
              <h3>Hạng vé</h3>
              {ticketTypes
                .filter((ticketType) => ticketType.isVisible !== false)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((ticketType) => {
                  const isSoldOut = ticketType.status === "SOLD_OUT" || ticketType.quantityAvailable === 0;
                  const hasSelection = (quantities[ticketType.id] || 0) > 0;

                  return (
                    <div
                      key={ticketType.id}
                      className={`tier-item ${isSoldOut ? "sold-out" : ""} ${hasSelection ? "active" : ""}`}
                    >
                      <div className="tier-left">
                        <span
                          className="tier-dot"
                          style={{ backgroundColor: ticketType.colorCode || "var(--text-muted)" }}
                        />
                        <span className="tier-name">{ticketType.name}</span>
                      </div>
                      <span className="tier-price">
                        {isSoldOut ? "Hết vé" : `${ticketType.price.toLocaleString("vi-VN")} đ`}
                      </span>
                    </div>
                  );
                })}

              <div className="ticket-notice" style={{ marginTop: 12 }}>
                <Info size={14} />
                <span>
                  Tối thiểu {minPerOrder}, tối đa {maxPerOrder} vé · {availableSeatCount} ghế trong
                </span>
              </div>
            </div>

            <div className="sidebar-selected">
              <div className="selected-header">
                <span className="label">Da chon</span>
                {selectedSeats.length > 0 && (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {selectedSeats.length} ghe
                  </span>
                )}
              </div>

              {selectedSeats.length === 0 ? (
                <div className="selected-empty">Chưa chọn ghế nào</div>
              ) : (
                <div className="selected-seats-list">
                  {selectedSeats.map((seat) => (
                    <span key={seat.seatId} className="selected-seat-tag">
                      {seat.seatLabel}
                      <span className="remove-seat" onClick={() => handleRemoveSeat(seat.seatId)}>
                        <X size={12} />
                      </span>
                    </span>
                  ))}
                </div>
              )}

              <div className="sidebar-action-embedded">
                {selectedSeats.length === 0 ? (
                  <button className="action-btn disabled-state" disabled>
                    Vui long lua chon ghe
                  </button>
                ) : (
                  <button
                    className="action-btn active-state"
                    onClick={handleContinue}
                    disabled={totalSelected < minPerOrder}
                  >
                    <span className="btn-label">Thanh toán ngay</span>
                    <span className="btn-total">{subtotal.toLocaleString("vi-VN")} d</span>
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
