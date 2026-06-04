import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
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
  const { i18n, t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const language = i18n.resolvedLanguage || "vi";

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
        setError(t("selectTicket.ticketLoadFailed"));
        toast.error(t("selectTicket.ticketLoadFailed"));
      })
      .finally(() => setIsLoading(false));
  }, [slug, t]);

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
      ticketTypes
        .filter((ticketType) => ticketType.isVisible !== false)
        .filter((ticketType) => {
        const sectorId = getTicketTypeSectorId(ticketType);
        return sectorId && getSectorType(sectorById.get(sectorId)) === "STANDING";
      })
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [ticketTypes, sectorById],
  );

  const orderQuantityTicketTypes = useMemo(() => {
    const mapping = new Map<string, TicketType>();
    [...quantityTicketTypes, ...standingSectorTicketTypes].forEach((ticketType) => {
      mapping.set(ticketType.id, ticketType);
    });
    return [...mapping.values()];
  }, [quantityTicketTypes, standingSectorTicketTypes]);

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
  const standingPopupTotal = standingPopupTicketTypes.reduce(
    (sum, ticketType) => sum + (quantities[ticketType.id] || 0) * Number(ticketType.price || 0),
    0,
  );

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
        sectorId &&
        getSectorType(sectorById.get(sectorId)) === "STANDING" &&
        sectorId !== selectedStandingSectorId
      ) {
        toast.warning(t("selectTicket.selectStandingSectorFirst"), {
          toastId: "select-standing-sector",
        });
        return;
      }

      const currentQuantity = quantities[ticketType.id] || 0;
      const nextQuantity = Math.max(0, currentQuantity + delta);
      const nextTotal = totalSelected - currentQuantity + nextQuantity;

      if (nextTotal > maxPerOrder) {
        toast.warning(t("selectTicket.maxPerOrder", { count: maxPerOrder }), {
          toastId: "max-ticket-limit",
        });
        return;
      }

      if (nextQuantity > ticketType.maxPerOrder) {
        toast.warning(t("selectTicket.ticketTypeMax", { count: ticketType.maxPerOrder }), {
          toastId: `ticket-max-${ticketType.id}`,
        });
        return;
      }

      if (nextQuantity > (ticketType.quantityAvailable || 0)) {
        toast.warning(t("selectTicket.ticketTypeAvailable"), {
          toastId: `ticket-available-${ticketType.id}`,
        });
        return;
      }

      setQuantities((prev) => ({
        ...prev,
        [ticketType.id]: nextQuantity,
      }));
    },
    [maxPerOrder, quantities, selectedStandingSectorId, sectorById, t, totalSelected],
  );

  const handleSectorClick = useCallback(
    (sector: PublicSeatSector) => {
      if (getSectorType(sector) !== "STANDING") {
        return;
      }

      const activeSectorId = selectedSeats[0]?.sectorId || selectedStandingSectorId;
      if (activeSectorId && activeSectorId !== sector.id) {
        toast.warning(t("selectTicket.oneSectorOnly"), {
          toastId: "single-sector-limit",
        });
        return;
      }

      const hasTicketType = standingSectorTicketTypes.some(
        (ticketType) => getTicketTypeSectorId(ticketType) === sector.id,
      );
      if (!hasTicketType) {
        toast.warning(t("selectTicket.noTicketInStandingSector"), {
          toastId: `standing-sector-${sector.id}`,
        });
        return;
      }

      setSelectedStandingSectorId(sector.id);
      setStandingPopupSectorId(sector.id);
    },
    [selectedSeats, selectedStandingSectorId, standingSectorTicketTypes, t],
  );

  const clearStandingSectorSelection = useCallback(() => {
    if (selectedStandingSectorId) {
      const ticketTypeIds = standingSectorTicketTypes
        .filter((ticketType) => getTicketTypeSectorId(ticketType) === selectedStandingSectorId)
        .map((ticketType) => ticketType.id);

      setQuantities((prev) => {
        const next = { ...prev };
        ticketTypeIds.forEach((ticketTypeId) => {
          delete next[ticketTypeId];
        });
        return next;
      });
    }

    setSelectedStandingSectorId(null);
    setStandingPopupSectorId(null);
  }, [selectedStandingSectorId, standingSectorTicketTypes]);

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
        toast.warning(t("selectTicket.unmappedSector"));
        return;
      }

      if (getInventoryMode(ticketType) !== "ASSIGNED_SEAT") {
        return;
      }

      const activeSectorId = selectedSeats[0]?.sectorId || selectedStandingSectorId;
      if (activeSectorId && activeSectorId !== sector.id) {
        toast.warning(t("selectTicket.oneSectorOnly"), {
          toastId: "single-sector-limit",
        });
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
        toast.warning(t("selectTicket.maxPerOrder", { count: maxPerOrder }), {
          toastId: "max-ticket-limit",
        });
        return;
      }

      if ((quantities[ticketType.id] || 0) >= (ticketType.quantityAvailable || 0)) {
        toast.warning(t("selectTicket.ticketTypeAvailable"), {
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
    [maxPerOrder, quantities, selectedSeats, selectedStandingSectorId, t, ticketTypeById, ticketTypeBySectorId, totalSelected],
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
      errors.name = t("selectTicket.formNameRequired");
    }
    if (!modalEmail.trim()) {
      errors.email = t("selectTicket.formEmailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalEmail)) {
      errors.email = t("selectTicket.formEmailInvalid");
    }
    const cleanPhone = modalPhone.replace(/\s/g, "");
    if (!cleanPhone) {
      errors.phone = t("selectTicket.formPhoneRequired");
    } else if (!/^(?:\+84|0)[0-9]{8,10}$/.test(cleanPhone)) {
      errors.phone = t("selectTicket.formPhoneInvalid");
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

      const quantityItems = orderQuantityTicketTypes
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

      toast.success(t("selectTicket.bookingSuccess"));
      setIsModalOpen(false);
      navigate(`/checkout?orderId=${response.orderId}`);
    } catch (err: any) {
      console.error("Booking error:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          t("selectTicket.bookingFailed"),
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
      toast.warning(t("selectTicket.minRequired", { count: minPerOrder }));
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
      toast.warning(t("selectTicket.assignedSeatQuantityMismatch"));
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
          <span>{t("selectTicket.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="select-ticket-page">
        <div style={{ textAlign: "center", padding: "100px", color: "red" }}>
          <p>{error || t("selectTicket.eventNotFound")}</p>
          <Link
            to="/"
            style={{ textDecoration: "underline", color: "var(--primary)" }}
          >
            {t("selectTicket.returnHome")}
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
            <span>{t("selectTicket.back")}</span>
          </button>

          {hasInteractiveSeatMap ? (
            <div className="select-ticket-floating-zoom" aria-label={t("selectTicket.interactiveMapControls")}>
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

          {hasInteractiveSeatMap ? (
            <div className="select-ticket-map-heading">
              <h1>{t("selectTicket.chooseSector")}</h1>
              <p>{t("selectTicket.clickSector")}</p>
            </div>
          ) : null}

          <div className="seat-map-section">
            <div className={`seat-map-container ${hasInteractiveSeatMap ? "has-interactive-map" : ""}`}>
              {hasInteractiveSeatMap && seatMap ? (
                <>
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
                  <div className="seat-map-status-legend" aria-label={t("selectTicket.seatLegend")}>
                    <strong>{t("selectTicket.seatLegend")}</strong>
                    <div className="seat-map-status-legend-grid">
                      <span><i className="legend-seat-dot is-available" />{t("selectTicket.seatAvailable")}</span>
                      <span><i className="legend-seat-dot is-selected" />{t("selectTicket.seatSelected")}</span>
                      <span><i className="legend-seat-dot is-sold" />{t("selectTicket.seatSold")}</span>
                      <span><i className="legend-seat-dot is-locked" />{t("selectTicket.seatLocked")}</span>
                      <span><i className="legend-seat-dot is-unavailable" />{t("selectTicket.seatUnavailable")}</span>
                    </div>
                  </div>
                </>
              ) : !hasAssignedSeatTickets && !hasStandingSectorTickets ? (
                <div className="quantity-booking-panel">
                  <h2>{t("selectTicket.quantityBookingTitle")}</h2>
                  <p>{t("selectTicket.quantityBookingDescription")}</p>

                  <div className="quantity-ticket-list">
                    {quantityTicketTypes.length === 0 ? (
                      <div className="selected-empty">{t("selectTicket.noMatchingTicketType")}</div>
                    ) : (
                      quantityTicketTypes.map((ticketType) => {
                        const isSoldOut =
                          ticketType.status === "SOLD_OUT" ||
                          ticketType.quantityAvailable === 0;

                        return (
                          <div
                            className={`quantity-ticket-row ${isSoldOut ? "sold-out" : ""}`}
                            key={ticketType.id}
                          >
                            <div className="quantity-ticket-copy">
                              <strong>{ticketType.name}</strong>
                              <span>
                                {isSoldOut
                                  ? t("selectTicket.soldOut")
                                  : `${ticketType.price.toLocaleString(language === "en" ? "en-US" : "vi-VN")} ₫`}
                              </span>
                            </div>

                            <div
                              className="quantity-selector quantity-selector-main"
                              aria-label={t("selectTicket.chooseQuantity", { name: ticketType.name })}
                            >
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="buyer-seat-map-empty">
                  <div className="quantity-booking-notice">
                    <div className="notice-icon-wrapper">
                      <Info size={40} className="notice-icon" />
                    </div>
                    <h3>{t("selectTicket.noSeatMapTitle")}</h3>
                    <p>{t("selectTicket.noPublishedSeatMap")}</p>
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
                      {startDate.toLocaleDateString(language === "en" ? "en-US" : "vi-VN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {" · "}
                      {startDate.toLocaleTimeString(language === "en" ? "en-US" : "vi-VN", {
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
              <h3>{t("selectTicket.ticketPrice")}</h3>
              {visibleTicketTypes.length === 0 ? (
                <div className="selected-empty">{t("selectTicket.noMatchingTicketType")}</div>
              ) : (
                visibleTicketTypes.map((ticketType) => {
                  const isSoldOut = ticketType.status === "SOLD_OUT" || ticketType.quantityAvailable === 0;

                  return (
                    <div
                      key={ticketType.id}
                      className={`tier-item ${isSoldOut ? "sold-out" : ""}`}
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
                        {isSoldOut ? t("selectTicket.soldOut") : `${ticketType.price.toLocaleString(language === "en" ? "en-US" : "vi-VN")} ₫`}
                      </span>
                    </div>
                  );
                })
              )}

              <div className="ticket-notice" style={{ marginTop: 12 }}>
                <Info size={14} />
                <span>
                  {t("selectTicket.minMaxNotice", { min: minPerOrder, max: maxPerOrder })}
                  {hasAssignedSeatTickets ? ` · ${t("selectTicket.availableSeats", { count: availableSeatCount })}` : ""}
                </span>
              </div>
            </div>

            <div className="sidebar-selected">
              <div className="selected-header">
                <span className="label">{t("selectTicket.selected")}</span>
                {totalSelected > 0 && (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {totalSelected} {t("nav.tickets").toLowerCase()}
                  </span>
                )}
              </div>

              {totalSelected === 0 ? (
                <div className="selected-empty">{t("selectTicket.emptySelection")}</div>
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
                    {t("selectTicket.selectAtLeastTicket")}
                  </button>
                ) : (
                  <button
                    className="action-btn active-state"
                    onClick={handleContinue}
                    disabled={totalSelected < minPerOrder}
                  >
                    <span className="btn-label">{t("selectTicket.paymentNow")}</span>
                    <span className="btn-total">{subtotal.toLocaleString(language === "en" ? "en-US" : "vi-VN")} ₫</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      {standingPopupSector && standingPopupTicketTypes.length > 0 ? (
        <div className="standing-ticket-popup-overlay" role="dialog" aria-modal="true">
          <div className="standing-ticket-popup">
            <button
              type="button"
              className="standing-ticket-popup-close"
              onClick={clearStandingSectorSelection}
              aria-label={t("common.close")}
            >
              <X size={22} />
            </button>
            <h3>{t("selectTicket.zone")} {standingPopupSector.name}</h3>
            <p className="standing-ticket-popup-note">{t("selectTicket.oneSectorOnly")}</p>
            <div className="standing-ticket-popup-list">
              {standingPopupTicketTypes.map((ticketType) => (
                <div className="standing-ticket-popup-row" key={ticketType.id}>
                  <span className="standing-ticket-popup-name">
                    <strong>{ticketType.name}</strong>
                    <small>{Number(ticketType.price || 0).toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ</small>
                  </span>
                  <div className="standing-ticket-popup-quantity">
                    <button
                      type="button"
                      onClick={() => updateQuantity(ticketType, -1)}
                      disabled={(quantities[ticketType.id] || 0) <= 0}
                    >
                      -
                    </button>
                    <span>{quantities[ticketType.id] || 0}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(ticketType, 1)}
                      disabled={ticketType.status === "SOLD_OUT" || ticketType.quantityAvailable === 0}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="standing-ticket-popup-switch"
              onClick={clearStandingSectorSelection}
            >
              {t("selectTicket.chooseAnotherSector")}
            </button>
            <button
              type="button"
              className="standing-ticket-popup-continue"
              onClick={() => setStandingPopupSectorId(null)}
            >
              <span>{t("selectTicket.continue")}</span>
              <span>- {standingPopupTotal.toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : null}
      {isModalOpen && (
        <div className="booking-info-modal-overlay" role="dialog" aria-modal="true">
          <form className="booking-info-modal" onSubmit={handleModalSubmit}>
            <div className="booking-info-modal-header">
              <h3>{t("selectTicket.recipientInfo")}</h3>
              <button
                type="button"
                className="booking-info-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label={t("common.close")}
                disabled={isBookingInProgress}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="booking-info-modal-body">
              <div className="form-group">
                <label>
                  {t("selectTicket.fullName")} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${modalErrors.name ? "error" : ""}`}
                  placeholder={t("selectTicket.fullNamePlaceholder")}
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
                  {t("profile.email")} <span className="required">*</span>
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
                  {t("selectTicket.phone")} <span className="required">*</span>
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
                <label>{t("selectTicket.discountCode")}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t("selectTicket.voucherPlaceholder")}
                  value={modalVoucher}
                  onChange={(e) => setModalVoucher(e.target.value.toUpperCase())}
                  disabled={isBookingInProgress}
                />
              </div>

              <div className="form-group">
                <label>{t("selectTicket.note")}</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: "60px", resize: "vertical" }}
                  placeholder={t("selectTicket.notePlaceholder")}
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
                {t("selectTicket.cancel")}
              </button>
              <button
                type="submit"
                className="btn-confirm"
                disabled={isBookingInProgress}
              >
                {isBookingInProgress ? t("selectTicket.holdProcessing") : t("selectTicket.confirmHold")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
