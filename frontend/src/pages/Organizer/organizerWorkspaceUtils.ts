import {
  OrganizerEventDetail,
  OrganizerEventStatus,
  OrganizerSeatMap,
  OrganizerTicketStatus,
} from "../../services/organizerWorkspaceService";

type StatusMeta = {
  label: string;
  className: string;
};

const EVENT_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: "Bản nháp", className: "is-muted" },
  PUBLISHED: { label: "Đã phát hành", className: "is-success" },
  CANCELLED: { label: "Đã hủy", className: "is-danger" },
  SOLD_OUT: { label: "Hết vé", className: "is-warning" },
};

const TICKET_STATUS_META: Record<string, StatusMeta> = {
  ACTIVE: { label: "Đang bán", className: "is-success" },
  INACTIVE: { label: "Tạm ẩn", className: "is-muted" },
  SOLD_OUT: { label: "Hết vé", className: "is-warning" },
};

export function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
}

export function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function toIsoString(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function getEventTicketsSold(event: OrganizerEventDetail): number {
  if (typeof event.statistics?.ticketsSold === "number") {
    return event.statistics.ticketsSold;
  }

  return (event.ticketTypes ?? []).reduce((sum, ticketType) => {
    const total = Number(ticketType.quantityTotal ?? 0);
    const available = Number(ticketType.quantityAvailable ?? total);
    const reserved = Number(ticketType.quantityReserved ?? 0);
    const sold = Math.max(total - available - reserved, 0);
    return sum + sold;
  }, 0);
}

export function getEventTicketCapacity(event: OrganizerEventDetail): number {
  if (typeof event.statistics?.totalCapacity === "number") {
    return event.statistics.totalCapacity;
  }

  return (event.ticketTypes ?? []).reduce(
    (sum, ticketType) => sum + Math.max(Number(ticketType.quantityTotal ?? 0), 0),
    0,
  );
}

export function getEventEstimatedRevenue(event: OrganizerEventDetail): number {
  return (event.ticketTypes ?? []).reduce((sum, ticketType) => {
    const total = Number(ticketType.quantityTotal ?? 0);
    const available = Number(ticketType.quantityAvailable ?? total);
    const reserved = Number(ticketType.quantityReserved ?? 0);
    const sold = Math.max(total - available - reserved, 0);
    return sum + sold * Number(ticketType.price ?? 0);
  }, 0);
}

export function getEventStatusMeta(status?: OrganizerEventStatus | string | null): StatusMeta {
  return EVENT_STATUS_META[status ?? ""] ?? {
    label: status || "Không rõ",
    className: "is-muted",
  };
}

export function getTicketTypeStatusMeta(
  status?: OrganizerTicketStatus | string | null,
): StatusMeta {
  return TICKET_STATUS_META[status ?? ""] ?? {
    label: status || "Không rõ",
    className: "is-muted",
  };
}

export function summarizeSeatMap(seatMap?: OrganizerSeatMap | null) {
  const sectors = seatMap?.sectors ?? [];
  const activeSectors = sectors.filter((sector) => sector.isActive !== false);
  const seats = activeSectors.flatMap((sector) => sector.seatsData ?? []);

  return {
    sectorCount: activeSectors.length,
    seatCount: seats.length,
    activeSeatCount: seats.filter((seat) => seat.isActive !== false).length,
    soldSeatCount: seats.filter((seat) => seat.inventoryStatus === "SOLD").length,
    lockedSeatCount: seats.filter((seat) => seat.inventoryStatus === "LOCKED").length,
    reservedSeatCount: seats.filter((seat) => seat.inventoryStatus === "RESERVED").length,
  };
}
