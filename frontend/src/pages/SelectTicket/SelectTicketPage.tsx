import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import { LuTicketsPlane } from "react-icons/lu";
import { FaCalendarCheck, FaMapLocationDot } from "react-icons/fa6";
import { eventService } from "../../services/eventService";
import { bookingService } from "../../services/bookingService";
import {
  EventSummary,
  PublicSeat,
  PublicSeatMap,
  PublicSeatSector,
  TicketInventoryMode,
  TicketType,
} from "../../types/api";
import BuyerSeatMapCanvas from "../../components/seat-map/runtime/BuyerSeatMapCanvas";
import {
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
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
  sectorId: string;
  seatLabel: string;
  price: number;
}

function getInventoryMode(ticketType: TicketType): TicketInventoryMode {
  if (ticketType.inventoryMode === "ASSIGNED_SEAT" || ticketType.inventoryMode === "QUANTITY") {
    return ticketType.inventoryMode;
  }

  return ticketType.seatSelectionEnabled ? "ASSIGNED_SEAT" : "QUANTITY";
}

function getTicketTypeSectorId(ticketType: TicketType) {
  return ticketType.eventSectorId || ticketType.sectorId || "";
}

function getSectorTicketTypeId(sector: PublicSeatSector) {
  const mapData = sector.mapData ?? {};
  return typeof mapData.ticketTypeId === "string" ? mapData.ticketTypeId : "";
}

function getSeatTicketTypeId(sector: PublicSeatSector, seat: PublicSeat) {
  return seat.ticketTypeId || getSectorTicketTypeId(sector);
}

function getSectorType(sector?: PublicSeatSector | null) {
  return String(sector?.sectorType || sector?.mapData?.sectorType || "").toUpperCase();
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
  const [selectedStandingSectorId, setSelectedStandingSectorId] = useState<string | null>(null);
  const [standingPopupSectorId, setStandingPopupSectorId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalVoucher, setModalVoucher] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);

  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    if (keycloak?.authenticated && keycloak?.tokenParsed) {
      const parsed = keycloak.tokenParsed as Record<string, any>;
      const fullName =
        parsed.name ||
        `${parsed.given_name || ""} ${parsed.family_name || ""}`.trim();
      const email = parsed.email || "";
      const phone = parsed.phone_number || parsed.phone || "";

      if (fullName) setModalName(fullName);
      if (email) setModalEmail(email);
      if (phone) setModalPhone(phone);
    }
  }, [keycloak?.authenticated, keycloak?.tokenParsed]);

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

        // Check if there is transient selection to restore
        const savedSlug = sessionStorage.getItem("transient_slug");
        let restored = false;
        if (savedSlug === slug) {
          const savedQty = sessionStorage.getItem("transient_quantities");
          const savedSeats = sessionStorage.getItem("transient_selectedSeats");
          const savedStanding = sessionStorage.getItem("transient_selectedStandingSectorId");
          if (savedQty) {
            setQuantities(JSON.parse(savedQty));
            restored = true;
          }
          if (savedSeats) {
            setSelectedSeats(JSON.parse(savedSeats));
          }
          if (savedStanding) {
            setSelectedStandingSectorId(savedStanding);
          }
          // Clear them
          sessionStorage.removeItem("transient_slug");
          sessionStorage.removeItem("transient_quantities");
          sessionStorage.removeItem("transient_selectedSeats");
          sessionStorage.removeItem("transient_selectedStandingSectorId");
        }

        if (!restored) {
          const initQty: TicketSelection = {};
          types.forEach((ticketType: TicketType) => {
            initQty[ticketType.id] = 0;
          });
          setQuantities(initQty);
          setSelectedStandingSectorId(null);
        }
        setError(null);
      })
      .catch((err: any) => {
        console.error("Failed to load event or seat map:", err);
        setError("Vui lòng tải lại trang");
        toast.error("Không thể tải thông tin sự kiện.");
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

  const sectorById = useMemo(() => {
    const mapping = new Map<string, PublicSeatSector>();
    (seatMap?.sectors ?? []).forEach((sector) => {
      mapping.set(sector.id, sector);
    });
    return mapping;
  }, [seatMap]);

  const quantityTicketTypes = useMemo(
    () =>
      ticketTypes
        .filter((ticketType) => ticketType.isVisible !== false && getInventoryMode(ticketType) === "QUANTITY")
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [ticketTypes],
  );

  const assignedSeatTicketTypes = useMemo(
    () =>
      ticketTypes
        .filter((ticketType) => ticketType.isVisible !== false && getInventoryMode(ticketType) === "ASSIGNED_SEAT")
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [ticketTypes],
  );

  const hasAssignedSeatTickets = assignedSeatTicketTypes.length > 0;

  const standingSectorTicketTypes = useMemo(
    () =>
      quantityTicketTypes.filter((ticketType) => {
        const sectorId = getTicketTypeSectorId(ticketType);
        return sectorId && getSectorType(sectorById.get(sectorId)) === "STANDING";
      }),
    [quantityTicketTypes, sectorById],
  );

  const hasStandingSectorTickets = standingSectorTicketTypes.length > 0;
  const hasInteractiveSeatMap = Boolean(seatMap && (hasAssignedSeatTickets || hasStandingSectorTickets));

  const visibleTicketTypes = useMemo(
    () =>
      ticketTypes
        .filter((ticketType) => ticketType.isVisible !== false)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [ticketTypes],
  );

  const standingPopupSector = standingPopupSectorId
    ? sectorById.get(standingPopupSectorId)
    : null;
  const standingPopupTicketTypes = standingPopupSector
    ? standingSectorTicketTypes.filter(
        (ticketType) => getTicketTypeSectorId(ticketType) === standingPopupSector.id,
      )
    : [];
  const standingPopupPrimaryTicket = standingPopupTicketTypes[0] ?? null;

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

  const updateQuantity = useCallback(
    (ticketType: TicketType, delta: number) => {
      const sectorId = getTicketTypeSectorId(ticketType);
      if (
        getInventoryMode(ticketType) === "QUANTITY" &&
        sectorId &&
        getSectorType(sectorById.get(sectorId)) === "STANDING" &&
        sectorId !== selectedStandingSectorId
      ) {
        toast.warning("Vui lòng chọn khu đứng trên sơ đồ trước khi chọn số lượng vé.", {
          toastId: "select-standing-sector",
        });
        return;
      }

      const currentQuantity = quantities[ticketType.id] || 0;
      const nextQuantity = Math.max(0, currentQuantity + delta);
      const nextTotal = totalSelected - currentQuantity + nextQuantity;

      if (nextTotal > maxPerOrder) {
        toast.warning(`Bạn chỉ được chọn tối đa ${maxPerOrder} vé.`, {
          toastId: "max-ticket-limit",
        });
        return;
      }

      if (nextQuantity > ticketType.maxPerOrder) {
        toast.warning(`Loại vé này cho phép tối đa ${ticketType.maxPerOrder} vé mỗi đơn.`, {
          toastId: `ticket-max-${ticketType.id}`,
        });
        return;
      }

      if (nextQuantity > (ticketType.quantityAvailable || 0)) {
        toast.warning("Loại vé này không còn số lượng phù hợp.", {
          toastId: `ticket-available-${ticketType.id}`,
        });
        return;
      }

      setQuantities((prev) => ({
        ...prev,
        [ticketType.id]: nextQuantity,
      }));
    },
    [maxPerOrder, quantities, selectedStandingSectorId, sectorById, totalSelected],
  );

  const handleSectorClick = useCallback(
    (sector: PublicSeatSector) => {
      if (getSectorType(sector) !== "STANDING") {
        return;
      }

      const hasTicketType = standingSectorTicketTypes.some(
        (ticketType) => getTicketTypeSectorId(ticketType) === sector.id,
      );
      if (!hasTicketType) {
        toast.warning("Khu đứng này chưa có loại vé đang mở bán.", {
          toastId: `standing-sector-${sector.id}`,
        });
        return;
      }

      setSelectedStandingSectorId(sector.id);
      setStandingPopupSectorId(sector.id);
    },
    [standingSectorTicketTypes],
  );

  const handleSeatClick = useCallback(
    (sector: PublicSeatSector, seat: PublicSeat) => {
      if (seat.isActive === false || seat.inventoryStatus !== "AVAILABLE") {
        return;
      }

      const ticketType =
        ticketTypeById.get(getSeatTicketTypeId(sector, seat)) ||
        ticketTypeBySectorId.get(sector.id) ||
        ticketTypeById.get(getSectorTicketTypeId(sector));
      if (!ticketType) {
        toast.warning("Khu vực này chưa được gắn loại vé.");
        return;
      }

      if (getInventoryMode(ticketType) !== "ASSIGNED_SEAT") {
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
        toast.warning(`Bạn chỉ được chọn tối đa ${maxPerOrder} vé.`, {
          toastId: "max-ticket-limit",
        });
        return;
      }

      const selectedSectorId = selectedSeats[0]?.sectorId;
      if (selectedSectorId && selectedSectorId !== sector.id) {
        toast.warning("Mỗi lần đặt vé chỉ được chọn ghế trong cùng một khu vực.", {
          toastId: "single-sector-limit",
        });
        return;
      }

      if ((quantities[ticketType.id] || 0) >= (ticketType.quantityAvailable || 0)) {
        toast.warning("Loại vé này không còn số lượng phù hợp.", {
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
          sectorId: sector.id,
          seatLabel: displayLabel,
          price: Number(seat.price ?? ticketType.price ?? 0),
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

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!modalName.trim()) {
      errors.name = "Vui lòng nhập họ tên";
    }
    if (!modalEmail.trim()) {
      errors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalEmail)) {
      errors.email = "Email không hợp lệ";
    }
    const cleanPhone = modalPhone.replace(/\s/g, "");
    if (!cleanPhone) {
      errors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^(?:\+84|0)[0-9]{8,10}$/.test(cleanPhone)) {
      errors.phone = "Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84)";
    }

    if (Object.keys(errors).length > 0) {
      setModalErrors(errors);
      return;
    }

    setModalErrors({});
    setIsBookingInProgress(true);

    try {
      const selectedSeatItems = Array.from(
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

      const quantityItems = quantityTicketTypes
        .map((ticketType) => ({
          ticketTypeId: ticketType.id,
          quantity: quantities[ticketType.id] || 0,
        }))
        .filter((item) => item.quantity > 0);

      const items = [...quantityItems, ...selectedSeatItems];

      if (!event) throw new Error("Event missing");

      const response = await bookingService.createBooking({
        eventId: event.id,
        items,
        customerName: modalName.trim(),
        customerEmail: modalEmail.trim(),
        customerPhone: cleanPhone,
        promotionCode: modalVoucher.trim() || undefined,
        customerNote: modalNote.trim() || undefined,
      });

      // Clear transient storage
      sessionStorage.removeItem("transient_slug");
      sessionStorage.removeItem("transient_quantities");
      sessionStorage.removeItem("transient_selectedSeats");
      sessionStorage.removeItem("transient_selectedStandingSectorId");

      // Save order details to session for display
      sessionStorage.setItem("lastOrderId", response.orderId);
      sessionStorage.setItem("lastOrderNumber", response.orderNumber);

      toast.success("Giữ vé thành công!");
      setIsModalOpen(false);
      navigate(`/checkout?orderId=${response.orderId}`);
    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          "Không thể giữ vé. Vui lòng kiểm tra lại thông tin hoặc thử lại sau.",
      );
    } finally {
      setIsBookingInProgress(false);
    }
  };

  const resetView = () => {
    setZoom(0);
  };

  const handleContinue = () => {
    if (totalSelected < minPerOrder) {
      toast.warning(`Vui lòng chọn ít nhất ${minPerOrder} vé.`);
      return;
    }

    const selectedSeatItems = Array.from(
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
    const invalidSeatItem = selectedSeatItems.find(
      (item) => item.seatIds.length !== item.quantity,
    );

    if (invalidSeatItem) {
      toast.warning("Vé chọn ghế cần có số ghế bằng đúng số lượng.");
      return;
    }

    if (!keycloak?.authenticated) {
      // Save transient selection so we can restore it after redirect
      sessionStorage.setItem("transient_slug", slug || "");
      sessionStorage.setItem("transient_quantities", JSON.stringify(quantities));
      sessionStorage.setItem("transient_selectedSeats", JSON.stringify(selectedSeats));
      sessionStorage.setItem("transient_selectedStandingSectorId", selectedStandingSectorId || "");

      keycloak?.login({
        redirectUri: window.location.href,
      });
      return;
    }

    setIsModalOpen(true);
  };

  const subtotal = ticketTypes.reduce(
    (sum, ticketType) => sum + (quantities[ticketType.id] || 0) * Number(ticketType.price || 0),
    0,
  );

  const startStr =
    (event as any)?.schedule?.startDatetime ||
    (event as any)?.startDatetime ||
    (event as any)?.startTime;
  const startDate = startStr ? new Date(startStr) : null;
  const venueName = (event as any)?.venue?.name || (event as any)?.venueName || "";
  const venueAddress = (event as any)?.venue?.address || (event as any)?.venueAddress || "";

  if (isLoading) {
    return (
      <div className="select-ticket-page">
        <div className="select-ticket-loading" role="status" aria-live="polite">
          <LoaderCircle className="select-ticket-loading-icon" size={24} />
          <span>Loading</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="select-ticket-page">
        <div style={{ textAlign: "center", padding: "100px", color: "red" }}>
          <p>{error || "Không tìm thấy sự kiện"}</p>
          <Link
            to="/"
            style={{ textDecoration: "underline", color: "var(--primary)" }}
          >
            Quay về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="select-ticket-page">
      <div className="select-ticket-layout">
        <div className="select-ticket-map-panel">
          <button
            type="button"
            className="select-ticket-back-button"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={22} />
            <span>Trở về</span>
          </button>

          {hasInteractiveSeatMap ? (
            <div className="select-ticket-floating-zoom" aria-label="Điều khiển sơ đồ">
              <button type="button" className="zoom-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                <ZoomIn size={18} />
              </button>
              <button type="button" className="zoom-btn" onClick={resetView}>
                <RotateCcw size={18} />
              </button>
              <button type="button" className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}>
                <ZoomOut size={18} />
              </button>
            </div>
          ) : null}

          <div className="select-ticket-map-heading">
            <h1>Chọn khu vực</h1>
            <p>Bấm vào khu vực để chọn vé</p>
          </div>

          <div className="seat-map-section">
            <div className={`seat-map-container ${hasInteractiveSeatMap ? "has-interactive-map" : ""}`}>
              {hasInteractiveSeatMap && seatMap ? (
                <BuyerSeatMapCanvas
                  seatMap={seatMap}
                  zoom={zoom}
                  selectedSeatIds={selectedSeats.map((seat) => seat.seatId)}
                  selectedSectorId={selectedStandingSectorId}
                  getSeatColor={(sector, seat) => {
                    const ticketType =
                      ticketTypeById.get(getSeatTicketTypeId(sector, seat)) ||
                      ticketTypeBySectorId.get(sector.id);
                    return seat.colorCode || ticketType?.colorCode || sector.colorCode || "#16a34a";
                  }}
                  onZoomChange={setZoom}
                  onSeatClick={handleSeatClick}
                  onSectorClick={handleSectorClick}
                />
              ) : !hasAssignedSeatTickets && !hasStandingSectorTickets ? (
                <div className="buyer-seat-map-empty">
                  <div className="quantity-booking-notice">
                    <div className="notice-icon-wrapper">
                      <LuTicketsPlane size={40} className="notice-icon" />
                    </div>
                    <h3>Bán vé theo số lượng</h3>
                    <p>Sự kiện này bán vé theo số lượng. Chọn số lượng ở từng seat type để tiếp tục.</p>
                  </div>
                </div>
              ) : (
                <div className="buyer-seat-map-empty">
                  <div className="quantity-booking-notice">
                    <div className="notice-icon-wrapper">
                      <Info size={40} className="notice-icon" />
                    </div>
                    <h3>Không có sơ đồ ghế</h3>
                    <p>Sự kiện này chưa có sơ đồ chỗ ngồi được publish</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
          <div className="booking-sidebar">
            <div className="sidebar-event-card">
              <div className="sidebar-event-title-bar">
                <div className="event-title">{event.title}</div>
              </div>
              <div className="event-details">
                {startDate && (
                  <div className="event-meta-row">
                    <FaCalendarCheck size={14} />
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
                    <FaMapLocationDot size={14} />
                    <span>
                      {venueName}
                      {venueAddress ? `, ${venueAddress}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="sidebar-tiers">
              <h3>Giá vé</h3>
              {visibleTicketTypes.length === 0 ? (
                <div className="selected-empty">Chưa có loại vé phù hợp với khu đang chọn.</div>
              ) : (
                visibleTicketTypes.map((ticketType) => {
                  const isSoldOut = ticketType.status === "SOLD_OUT" || ticketType.quantityAvailable === 0;
                  const isQuantityMode = getInventoryMode(ticketType) === "QUANTITY";
                  const sectorId = getTicketTypeSectorId(ticketType);
                  const isStandingQuantityTicket =
                    isQuantityMode &&
                    sectorId &&
                    getSectorType(sectorById.get(sectorId)) === "STANDING";
                  const showQuantityControls = isQuantityMode && !isStandingQuantityTicket;

                  return (
                    <div
                      key={ticketType.id}
                      className={`tier-item ${showQuantityControls ? "tier-item-quantity" : ""} ${isSoldOut ? "sold-out" : ""}`}
                    >
                      <div className="tier-left">
                        <span
                          className="tier-dot"
                          style={{ backgroundColor: ticketType.colorCode || "var(--text-muted)" }}
                        />
                        <span className="tier-copy">
                          <span className="tier-name">{ticketType.name}</span>
                        </span>
                      </div>
                      <span className="tier-price">
                        {isSoldOut ? "Hết vé" : `${ticketType.price.toLocaleString("vi-VN")} ₫`}
                      </span>
                      {showQuantityControls ? (
                        <div className="quantity-selector" aria-label={`Chọn số lượng ${ticketType.name}`}>
                          <button
                            type="button"
                            className="quantity-btn"
                            onClick={() => updateQuantity(ticketType, -1)}
                            disabled={(quantities[ticketType.id] || 0) <= 0}
                          >
                            -
                          </button>
                          <span className="quantity-value">{quantities[ticketType.id] || 0}</span>
                          <button
                            type="button"
                            className="quantity-btn"
                            onClick={() => updateQuantity(ticketType, 1)}
                            disabled={isSoldOut}
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}

              <div className="ticket-notice" style={{ marginTop: 12 }}>
                <Info size={14} />
                <span>
                  Tối thiểu {minPerOrder}, tối đa {maxPerOrder} vé{hasAssignedSeatTickets ? ` · ${availableSeatCount} ghế trống` : ""}
                </span>
              </div>
            </div>

            <div className="sidebar-selected">
              <div className="selected-header">
                <span className="label">Đã chọn</span>
                {totalSelected > 0 && (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {totalSelected} vé
                  </span>
                )}
              </div>

              {totalSelected === 0 ? (
                <div className="selected-empty">Chưa chọn vé nào</div>
              ) : (
                <div className="selected-seats-list">
                  {quantityTicketTypes
                    .filter((ticketType) => (quantities[ticketType.id] || 0) > 0)
                    .map((ticketType) => {
                      const colorCode = ticketType.colorCode || "var(--primary, #16a34a)";
                      const selectedQuantity = quantities[ticketType.id] || 0;
                      return (
                        <span
                          key={ticketType.id}
                          className="selected-seat-tag"
                          style={{
                            backgroundColor: colorCode,
                            color: "#ffffff",
                            borderColor: colorCode,
                          }}
                        >
                          {ticketType.name} x{selectedQuantity}
                          <span className="remove-seat" onClick={() => updateQuantity(ticketType, -selectedQuantity)}>
                            <X size={12} />
                          </span>
                        </span>
                      );
                    })}
                  {selectedSeats.map((seat) => {
                    const ticketType = ticketTypeById.get(seat.ticketTypeId);
                    const colorCode = ticketType?.colorCode || "var(--primary, #16a34a)";
                    return (
                      <span
                        key={seat.seatId}
                        className="selected-seat-tag"
                        style={{
                          backgroundColor: colorCode,
                          color: "#ffffff",
                          borderColor: colorCode,
                        }}
                      >
                        {seat.seatLabel}
                        <span className="remove-seat" onClick={() => handleRemoveSeat(seat.seatId)}>
                          <X size={12} />
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="sidebar-action-embedded">
                {totalSelected === 0 ? (
                  <button className="action-btn disabled-state" disabled>
                    Vui lòng chọn vé
                  </button>
                ) : (
                  <button
                    className="action-btn active-state"
                    onClick={handleContinue}
                    disabled={totalSelected < minPerOrder}
                  >
                    <span className="btn-label">Thanh toán ngay</span>
                    <span className="btn-total">{subtotal.toLocaleString("vi-VN")} ₫</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      {standingPopupSector && standingPopupPrimaryTicket ? (
        <div className="standing-ticket-popup-overlay" role="dialog" aria-modal="true">
          <div className="standing-ticket-popup">
            <button
              type="button"
              className="standing-ticket-popup-close"
              onClick={() => setStandingPopupSectorId(null)}
              aria-label="Đóng"
            >
              <X size={22} />
            </button>
            <h3>Khu {standingPopupSector.name}</h3>
            <p className="standing-ticket-popup-note">Lưu ý: Bạn chỉ có thể chọn vé trong 1 khu vực</p>
            <div className="standing-ticket-popup-row">
              <span className="standing-ticket-popup-name">
                {standingPopupPrimaryTicket.name} (Standing)
              </span>
              <div className="standing-ticket-popup-quantity">
                <button
                  type="button"
                  onClick={() => updateQuantity(standingPopupPrimaryTicket, -1)}
                  disabled={(quantities[standingPopupPrimaryTicket.id] || 0) <= 0}
                >
                  -
                </button>
                <span>{quantities[standingPopupPrimaryTicket.id] || 0}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(standingPopupPrimaryTicket, 1)}
                  disabled={standingPopupPrimaryTicket.status === "SOLD_OUT" || standingPopupPrimaryTicket.quantityAvailable === 0}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              className="standing-ticket-popup-switch"
              onClick={() => setStandingPopupSectorId(null)}
            >
              Chọn khu vực khác
            </button>
            <button
              type="button"
              className="standing-ticket-popup-continue"
              onClick={() => setStandingPopupSectorId(null)}
            >
              <span>Tiếp tục</span>
              <span>- {((quantities[standingPopupPrimaryTicket.id] || 0) * Number(standingPopupPrimaryTicket.price || 0)).toLocaleString("vi-VN")} ₫</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : null}
      {isModalOpen && (
        <div className="booking-info-modal-overlay" role="dialog" aria-modal="true">
          <form className="booking-info-modal" onSubmit={handleModalSubmit}>
            <div className="booking-info-modal-header">
              <h3>Thông tin người nhận vé</h3>
              <button
                type="button"
                className="booking-info-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Đóng"
                disabled={isBookingInProgress}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="booking-info-modal-body">
              <div className="form-group">
                <label>
                  Họ và tên <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${modalErrors.name ? "error" : ""}`}
                  placeholder="Nhập họ và tên"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  disabled={isBookingInProgress}
                />
                {modalErrors.name && (
                  <div className="form-error">{modalErrors.name}</div>
                )}
              </div>

              <div className="form-group">
                <label>
                  Email <span className="required">*</span>
                </label>
                <input
                  type="email"
                  className={`form-input ${modalErrors.email ? "error" : ""}`}
                  placeholder="example@email.com"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  disabled={isBookingInProgress}
                />
                {modalErrors.email && (
                  <div className="form-error">{modalErrors.email}</div>
                )}
              </div>

              <div className="form-group">
                <label>
                  Số điện thoại <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  className={`form-input ${modalErrors.phone ? "error" : ""}`}
                  placeholder="09xx xxx xxx"
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  disabled={isBookingInProgress}
                />
                {modalErrors.phone && (
                  <div className="form-error">{modalErrors.phone}</div>
                )}
              </div>

              <div className="form-group">
                <label>Mã giảm giá (Voucher)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã voucher (nếu có)"
                  value={modalVoucher}
                  onChange={(e) => setModalVoucher(e.target.value.toUpperCase())}
                  disabled={isBookingInProgress}
                />
              </div>

              <div className="form-group">
                <label>Ghi chú</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: "60px", resize: "vertical" }}
                  placeholder="Ghi chú thêm (nếu có)"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  disabled={isBookingInProgress}
                />
              </div>
            </div>

            <div className="booking-info-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setIsModalOpen(false)}
                disabled={isBookingInProgress}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-confirm"
                disabled={isBookingInProgress}
              >
                {isBookingInProgress ? "Đang xử lý..." : "Xác nhận & Giữ vé"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
