import {
  OrganizerSeatMap,
  OrganizerSeatMapPublishPayload,
  OrganizerSeatSector,
} from "../../../services/organizerWorkspaceService";
import {
  SeatMapEditorBounds,
  SeatMapEditorDocument,
  SeatMapEditorSeat,
  SeatMapEditorSeatLayoutConfig,
  SeatMapEditorSectorType,
  SeatMapEditorShape,
  SeatMapEditorShapeType,
} from "./seatMapEditorTypes";
import { generateRingSeats } from "../shared/seatGenerationUtils";

const DEFAULT_CANVAS_WIDTH = 1280;
const DEFAULT_CANVAS_HEIGHT = 720;
const DEFAULT_SECTOR_COLORS = [
  "#16a34a",
  "#2563eb",
  "#ea580c",
  "#9333ea",
  "#0f766e",
  "#dc2626",
];
const DEFAULT_SEAT_RADIUS = 6;
const DEFAULT_ROW_START_CHAR_CODE = "A".charCodeAt(0);
const DRAFT_VERSION = 1;
const SECTOR_TYPES: SeatMapEditorSectorType[] = ["SEATED", "STANDING"];
const GENERATED_SEAT_SECTOR_TYPE: SeatMapEditorSectorType = "SEATED";

export function createEditorDraftKey(eventId: string) {
  return `seat-map-editor-draft:${eventId}`;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function buildBoundsFromAbsolutePoints(points: number[]): SeatMapEditorBounds | null {
  if (points.length < 6 || points.length % 2 !== 0) {
    return null;
  }

  const xs: number[] = [];
  const ys: number[] = [];

  for (let index = 0; index < points.length; index += 2) {
    xs.push(points[index]);
    ys.push(points[index + 1]);
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function normalizePolygonPoints(points: number[], bounds: SeatMapEditorBounds): number[] {
  if (points.length < 6) {
    return [];
  }

  return points.map((point, index) => (index % 2 === 0 ? point - bounds.x : point - bounds.y));
}

function normalizeBounds(mapData?: Record<string, unknown>): SeatMapEditorBounds | null {
  if (!mapData) {
    return null;
  }

  const bounds = mapData.bounds as Record<string, unknown> | undefined;
  const x = asNumber(bounds?.x ?? mapData.x ?? mapData.positionX);
  const y = asNumber(bounds?.y ?? mapData.y ?? mapData.positionY);
  const width = asNumber(bounds?.width ?? mapData.width ?? mapData.sizeX);
  const height = asNumber(bounds?.height ?? mapData.height ?? mapData.sizeY);

  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  return {
    x,
    y,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

function normalizeRawPoints(mapData?: Record<string, unknown>): number[] {
  if (!mapData) {
    return [];
  }

  const sourcePoints = Array.isArray(mapData.points) ? mapData.points : [];
  return sourcePoints
    .flatMap((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const x = asNumber(point[0]);
        const y = asNumber(point[1]);
        return x !== null && y !== null ? [x, y] : [];
      }

      if (point && typeof point === "object") {
        const x = asNumber((point as Record<string, unknown>).x);
        const y = asNumber((point as Record<string, unknown>).y);
        return x !== null && y !== null ? [x, y] : [];
      }

      if (typeof point === "number") {
        return [point];
      }

      return [];
    })
    .filter((value) => Number.isFinite(value));
}

function inferShapeType(
  mapData?: Record<string, unknown>,
  points?: number[],
): SeatMapEditorShapeType {
  const rawShapeType = typeof mapData?.shapeType === "string" ? mapData.shapeType : "";
  if (
    rawShapeType === "path" ||
    rawShapeType === "ringSection" ||
    rawShapeType === "fan" ||
    rawShapeType === "roundedRect" ||
    rawShapeType === "stage" ||
    rawShapeType === "foh"
  ) {
    return rawShapeType;
  }
  if (rawShapeType === "polygon") {
    return "polygon";
  }
  if (rawShapeType === "rect") {
    return "rectangle";
  }
  if (rawShapeType === "circle") {
    return "circle";
  }
  if (rawShapeType === "ellipse") {
    return "ellipse";
  }

  return points && points.length >= 6 ? "polygon" : "rectangle";
}

function normalizeSectorType(value: unknown, seatCount = 0): SeatMapEditorSectorType {
  return typeof value === "string" && SECTOR_TYPES.includes(value as SeatMapEditorSectorType)
    ? (value as SeatMapEditorSectorType)
    : seatCount > 0
      ? "SEATED"
      : "STANDING";
}

function buildFallbackBounds(
  sectorIndex: number,
  seatCount: number,
  canvasWidth: number,
  canvasHeight: number,
): SeatMapEditorBounds {
  const column = sectorIndex % 3;
  const row = Math.floor(sectorIndex / 3);
  const width = Math.max(Math.round(canvasWidth * 0.22), 200);
  const height = Math.max(Math.round(canvasHeight * 0.18), 130);
  const gapX = 32;
  const gapY = 28;

  return {
    x: 48 + column * (width + gapX),
    y: 56 + row * (height + gapY),
    width,
    height: Math.max(height, 96 + seatCount * 2),
  };
}

export function buildDefaultSeatLayoutConfig(
  bounds: SeatMapEditorBounds,
  seatCount = 0,
): SeatMapEditorSeatLayoutConfig {
  const suggestedRows = seatCount > 0 ? Math.max(1, Math.ceil(Math.sqrt(seatCount / 1.6))) : 4;
  const rows = Math.max(1, suggestedRows);
  const seatsPerRow = seatCount > 0 ? Math.max(1, Math.ceil(seatCount / rows)) : 6;

  return {
    rows,
    seatsPerRow,
    gapX: Math.max(18, Math.round(bounds.width / Math.max(seatsPerRow + 1, 3))),
    gapY: Math.max(18, Math.round(bounds.height / Math.max(rows + 2, 4))),
    paddingX: Math.max(16, Math.round(bounds.width * 0.08)),
    paddingY: Math.max(24, Math.round(bounds.height * 0.14)),
    offsetX: 0,
    offsetY: 0,
    mode: "grid",
    seatRadius: DEFAULT_SEAT_RADIUS,
    rowStartCharCode: DEFAULT_ROW_START_CHAR_CODE,
    seatStartNumber: 1,
  };
}

function normalizeSeatLayoutConfig(
  rawLayout: unknown,
  bounds: SeatMapEditorBounds,
  seatCount: number,
): SeatMapEditorSeatLayoutConfig {
  const fallback = buildDefaultSeatLayoutConfig(bounds, seatCount);
  const layout = rawLayout && typeof rawLayout === "object" ? (rawLayout as Record<string, unknown>) : {};

  return {
    mode: layout.mode === "arc" || layout.mode === "fan" ? layout.mode : fallback.mode,
    rows: Math.max(1, Math.round(asNumber(layout.rows) ?? fallback.rows)),
    seatsPerRow: Math.max(1, Math.round(asNumber(layout.seatsPerRow) ?? fallback.seatsPerRow)),
    gapX: Math.max(8, asNumber(layout.gapX) ?? fallback.gapX),
    gapY: Math.max(8, asNumber(layout.gapY) ?? fallback.gapY),
    paddingX: Math.max(4, asNumber(layout.paddingX) ?? fallback.paddingX),
    paddingY: Math.max(4, asNumber(layout.paddingY) ?? fallback.paddingY),
    offsetX: asNumber(layout.offsetX) ?? fallback.offsetX,
    offsetY: asNumber(layout.offsetY) ?? fallback.offsetY,
    seatRadius: Math.max(4, asNumber(layout.seatRadius) ?? fallback.seatRadius),
    rowStartCharCode: Math.round(asNumber(layout.rowStartCharCode) ?? fallback.rowStartCharCode),
    seatStartNumber: Math.max(1, Math.round(asNumber(layout.seatStartNumber) ?? fallback.seatStartNumber)),
  };
}

function formatRowName(rowIndex: number, rowStartCharCode: number) {
  let current = (rowStartCharCode - 65) + rowIndex;
  let rowName = "";

  while (current >= 0) {
    rowName = String.fromCharCode(65 + (current % 26)) + rowName;
    current = Math.floor(current / 26) - 1;
  }

  return rowName;
}

function buildSeatLabel(rowName: string, seatNumber: string) {
  return `${rowName}${seatNumber}`;
}

function translatePathData(pathData: string, deltaX: number, deltaY: number) {
  let coordinateIndex = 0;
  return pathData.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (match) => {
    const value = Number(match);
    if (!Number.isFinite(value)) {
      return match;
    }
    const translated = value + (coordinateIndex % 2 === 0 ? deltaX : deltaY);
    coordinateIndex += 1;
    return Number(translated.toFixed(3)).toString();
  });
}

function translateMapData(mapData: Record<string, unknown> | undefined, deltaX: number, deltaY: number) {
  if (!mapData) {
    return mapData;
  }

  const nextMapData: Record<string, unknown> = { ...mapData };
  const cx = asNumber(nextMapData.cx);
  const cy = asNumber(nextMapData.cy);
  if (cx !== null) nextMapData.cx = cx + deltaX;
  if (cy !== null) nextMapData.cy = cy + deltaY;

  if (typeof nextMapData.pathData === "string") {
    nextMapData.pathData = translatePathData(nextMapData.pathData, deltaX, deltaY);
  }

  if (nextMapData.labelPosition && typeof nextMapData.labelPosition === "object") {
    const labelPosition = nextMapData.labelPosition as Record<string, unknown>;
    const x = asNumber(labelPosition.x);
    const y = asNumber(labelPosition.y);
    nextMapData.labelPosition = {
      ...labelPosition,
      x: x !== null ? x + deltaX : labelPosition.x,
      y: y !== null ? y + deltaY : labelPosition.y,
    };
  }

  if (nextMapData.bounds && typeof nextMapData.bounds === "object") {
    const bounds = nextMapData.bounds as Record<string, unknown>;
    const x = asNumber(bounds.x);
    const y = asNumber(bounds.y);
    nextMapData.bounds = {
      ...bounds,
      x: x !== null ? x + deltaX : bounds.x,
      y: y !== null ? y + deltaY : bounds.y,
    };
  }

  return nextMapData;
}

function buildRelativePolygonPoints(shape: SeatMapEditorShape) {
  const relativePoints: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < shape.points.length; index += 2) {
    relativePoints.push({
      x: shape.points[index],
      y: shape.points[index + 1],
    });
  }
  return relativePoints;
}

function isPointInsidePolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>) {
  if (polygon.length < 3) {
    return true;
  }

  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-6) + xi;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isPointInsideEllipse(
  localX: number,
  localY: number,
  bounds: SeatMapEditorBounds,
  radius: number,
) {
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;
  const radiusX = Math.max(bounds.width / 2 - radius, 1);
  const radiusY = Math.max(bounds.height / 2 - radius, 1);

  const normalizedCenter =
    ((localX - centerX) * (localX - centerX)) / (radiusX * radiusX) +
    ((localY - centerY) * (localY - centerY)) / (radiusY * radiusY);

  if (normalizedCenter > 1) {
    return false;
  }

  const cardinalChecks: Array<[number, number]> = [
    [localX - radius, localY],
    [localX + radius, localY],
    [localX, localY - radius],
    [localX, localY + radius],
  ];

  return cardinalChecks.every(([x, y]) => {
    const normalized =
      ((x - centerX) * (x - centerX)) / (radiusX * radiusX) +
      ((y - centerY) * (y - centerY)) / (radiusY * radiusY);
    return normalized <= 1;
  });
}

function normalizeSeats(
  sector: OrganizerSeatSector,
  fallbackBounds: SeatMapEditorBounds,
): SeatMapEditorSeat[] {
  const seats = sector.seatsData ?? [];
  return seats
    .map((seat, index) => {
      const x = asNumber(seat.coordX) ?? fallbackBounds.x + 24 + (index % 8) * 22;
      const y = asNumber(seat.coordY) ?? fallbackBounds.y + 48 + Math.floor(index / 8) * 22;

      return {
        id: seat.id,
        label: seat.seatLabel || seat.seatNumber || seat.id,
        rowName: seat.rowName,
        seatNumber: seat.seatNumber,
        ticketTypeId: seat.ticketTypeId ?? undefined,
        colorCode: seat.colorCode ?? undefined,
        x,
        y,
        inventoryStatus: seat.inventoryStatus,
        hidden: false,
        manualAdjusted: false,
      };
    })
    .filter((seat) => Number.isFinite(seat.x) && Number.isFinite(seat.y));
}

function buildShape(
  sector: OrganizerSeatSector,
  sectorIndex: number,
  canvasWidth: number,
  canvasHeight: number,
): SeatMapEditorShape {
  const mapData = sector.mapData ?? {};
  const rawPoints = normalizeRawPoints(mapData);
  const inferredShapeType = inferShapeType(mapData, rawPoints);
  const normalizedBounds =
    normalizeBounds(mapData) ??
    (inferredShapeType === "polygon" ? buildBoundsFromAbsolutePoints(rawPoints) : null);
  const fallbackBounds =
    normalizedBounds ??
    buildFallbackBounds(sectorIndex, sector.seatsData?.length ?? 0, canvasWidth, canvasHeight);

  const points =
    inferredShapeType === "polygon" ? normalizePolygonPoints(rawPoints, fallbackBounds) : [];
  const color = sector.colorCode || DEFAULT_SECTOR_COLORS[sectorIndex % DEFAULT_SECTOR_COLORS.length];
  const seats = normalizeSeats(sector, fallbackBounds);
  const visible = sector.isActive !== false && mapData.visible !== false;
  const locked = mapData.locked === true;
  const zIndex = asNumber(mapData.zIndex) ?? sectorIndex;
  const totalCapacity = asNumber(sector.totalCapacity ?? mapData.totalCapacity) ?? undefined;

  return {
    id: sector.id,
    sectorId: sector.id,
    name: sector.name,
    code: typeof mapData.code === "string" ? mapData.code : undefined,
    ticketTypeId: typeof mapData.ticketTypeId === "string" ? mapData.ticketTypeId : undefined,
    ticketTypeName: typeof mapData.ticketTypeName === "string" ? mapData.ticketTypeName : undefined,
    sectorType: normalizeSectorType(sector.sectorType ?? mapData.sectorType, seats.length),
    totalCapacity,
    shapeType: inferredShapeType,
    mapData,
    color,
    bounds: fallbackBounds,
    points,
    label: sector.name,
    seatCount: seats.filter((seat) => !seat.hidden).length,
    seats,
    seatLayout: normalizeSeatLayoutConfig(mapData.seatLayout, fallbackBounds, seats.length),
    visible,
    locked,
    zIndex,
  };
}

export function sortShapesByZIndex(shapes: SeatMapEditorShape[]) {
  return [...shapes].sort((left, right) => left.zIndex - right.zIndex);
}

function isDeletedMapData(mapData?: Record<string, unknown>) {
  return mapData?.deleted === true;
}

export function buildSeatMapEditorDocument(seatMap: OrganizerSeatMap | null): SeatMapEditorDocument | null {
  if (!seatMap) {
    return null;
  }

  const width = Math.max(asNumber(seatMap.backgroundWidth) ?? DEFAULT_CANVAS_WIDTH, 640);
  const height = Math.max(asNumber(seatMap.backgroundHeight) ?? DEFAULT_CANVAS_HEIGHT, 420);
  const shapes = sortShapesByZIndex(
    (seatMap.sectors ?? [])
      .filter((sector) => !isDeletedMapData(sector.mapData))
      .map((sector, index) => buildShape(sector, index, width, height)),
  );

  return {
    width,
    height,
    referenceImageUrl: seatMap.backgroundImageUrl,
    shapes,
  };
}

export function getVisibleSeatCount(seats: SeatMapEditorSeat[]) {
  return seats.filter((seat) => !seat.hidden).length;
}

export function translateShape(shape: SeatMapEditorShape, deltaX: number, deltaY: number): SeatMapEditorShape {
  return {
    ...shape,
    mapData: translateMapData(shape.mapData, deltaX, deltaY),
    bounds: {
      ...shape.bounds,
      x: shape.bounds.x + deltaX,
      y: shape.bounds.y + deltaY,
    },
    seats: shape.seats.map((seat) => ({
      ...seat,
      x: seat.x + deltaX,
      y: seat.y + deltaY,
    })),
  };
}

export function scalePolygonPoints(points: number[], scaleX: number, scaleY: number): number[] {
  return points.map((point, index) => (index % 2 === 0 ? point * scaleX : point * scaleY));
}

export function scaleSeatsWithinBounds(
  seats: SeatMapEditorSeat[],
  previousBounds: SeatMapEditorBounds,
  nextBounds: SeatMapEditorBounds,
): SeatMapEditorSeat[] {
  const safeWidth = previousBounds.width || 1;
  const safeHeight = previousBounds.height || 1;

  return seats.map((seat) => {
    const relativeX = (seat.x - previousBounds.x) / safeWidth;
    const relativeY = (seat.y - previousBounds.y) / safeHeight;

    return {
      ...seat,
      x: nextBounds.x + relativeX * nextBounds.width,
      y: nextBounds.y + relativeY * nextBounds.height,
    };
  });
}

export function generateSeatsForShape(
  shape: SeatMapEditorShape,
  layoutOverrides?: Partial<SeatMapEditorSeatLayoutConfig>,
): SeatMapEditorShape {
  const seatLayout = {
    ...shape.seatLayout,
    ...layoutOverrides,
    rows: Math.max(1, Math.round(layoutOverrides?.rows ?? shape.seatLayout.rows)),
    seatsPerRow: Math.max(
      1,
      Math.round(layoutOverrides?.seatsPerRow ?? shape.seatLayout.seatsPerRow),
    ),
    gapX: Math.max(8, layoutOverrides?.gapX ?? shape.seatLayout.gapX),
    gapY: Math.max(8, layoutOverrides?.gapY ?? shape.seatLayout.gapY),
    paddingX: Math.max(4, layoutOverrides?.paddingX ?? shape.seatLayout.paddingX),
    paddingY: Math.max(4, layoutOverrides?.paddingY ?? shape.seatLayout.paddingY),
    offsetX: layoutOverrides?.offsetX ?? shape.seatLayout.offsetX,
    offsetY: layoutOverrides?.offsetY ?? shape.seatLayout.offsetY,
    mode: layoutOverrides?.mode ?? shape.seatLayout.mode ?? "grid",
    seatRadius: Math.max(4, layoutOverrides?.seatRadius ?? shape.seatLayout.seatRadius),
    rowStartCharCode: Math.round(
      layoutOverrides?.rowStartCharCode ?? shape.seatLayout.rowStartCharCode,
    ),
    seatStartNumber: Math.max(
      1,
      Math.round(layoutOverrides?.seatStartNumber ?? shape.seatLayout.seatStartNumber),
    ),
  };

  const polygon =
    shape.shapeType === "polygon" && shape.points.length >= 6 ? buildRelativePolygonPoints(shape) : [];
  const existingSeatMap = new Map<string, SeatMapEditorSeat>(
    shape.seats.map((seat) => [`${seat.rowName ?? ""}::${seat.seatNumber ?? ""}`, seat] as const),
  );
  const nextSeats: SeatMapEditorSeat[] = [];

  if (seatLayout.mode === "arc" || seatLayout.mode === "fan") {
    const mapData = shape.mapData ?? {};
    const cx = asNumber(mapData.cx) ?? shape.bounds.x + shape.bounds.width / 2;
    const cy = asNumber(mapData.cy) ?? shape.bounds.y + shape.bounds.height / 2;
    const startAngle = asNumber(mapData.startAngle) ?? -50;
    const endAngle = asNumber(mapData.endAngle) ?? 50;
    const startRadius =
      seatLayout.mode === "fan"
        ? Math.max(asNumber(mapData.innerRadius) ?? 42, 24)
        : Math.max(asNumber(mapData.innerRadius) ?? Math.min(shape.bounds.width, shape.bounds.height) * 0.35, 24);

    generateRingSeats({
      cx,
      cy,
      startRadius,
      rowSpacing: seatLayout.gapY,
      rows: seatLayout.rows,
      startAngle,
      endAngle,
      seatsPerRow: seatLayout.seatsPerRow,
    }).forEach((point) => {
      const rowName = formatRowName(point.rowIndex, seatLayout.rowStartCharCode);
      const seatNumber = String(seatLayout.seatStartNumber + point.seatIndex);
      const seatKey = `${rowName}::${seatNumber}`;
      const existingSeat = existingSeatMap.get(seatKey);
      nextSeats.push({
        id: existingSeat?.id ?? crypto.randomUUID(),
        label: buildSeatLabel(rowName, seatNumber),
        rowName,
        seatNumber,
        ticketTypeId: existingSeat?.ticketTypeId,
        colorCode: existingSeat?.colorCode,
        seatType: existingSeat?.seatType,
        x: point.x + seatLayout.offsetX,
        y: point.y + seatLayout.offsetY,
        inventoryStatus: existingSeat?.inventoryStatus,
        hidden: false,
        manualAdjusted: false,
      });
    });

    return {
      ...shape,
      sectorType: GENERATED_SEAT_SECTOR_TYPE,
      seatLayout,
      seats: nextSeats,
      seatCount: getVisibleSeatCount(nextSeats),
    };
  }

  for (let rowIndex = 0; rowIndex < seatLayout.rows; rowIndex += 1) {
    const rowName = formatRowName(rowIndex, seatLayout.rowStartCharCode);

    for (let seatIndex = 0; seatIndex < seatLayout.seatsPerRow; seatIndex += 1) {
      const localX = seatLayout.paddingX + seatLayout.seatRadius + seatLayout.offsetX + seatIndex * seatLayout.gapX;
      const localY = seatLayout.paddingY + seatLayout.seatRadius + seatLayout.offsetY + rowIndex * seatLayout.gapY;

      if (localX + seatLayout.seatRadius > shape.bounds.width - seatLayout.paddingX) {
        continue;
      }

      if (localY + seatLayout.seatRadius > shape.bounds.height - seatLayout.paddingY) {
        continue;
      }

      if (
        shape.shapeType === "polygon" &&
        polygon.length
      ) {
        const r = seatLayout.seatRadius;
        if (
          !isPointInsidePolygon(localX, localY, polygon) ||
          !isPointInsidePolygon(localX - r, localY, polygon) ||
          !isPointInsidePolygon(localX + r, localY, polygon) ||
          !isPointInsidePolygon(localX, localY - r, polygon) ||
          !isPointInsidePolygon(localX, localY + r, polygon)
        ) {
          continue;
        }
      }

      if (
        (shape.shapeType === "circle" || shape.shapeType === "ellipse") &&
        !isPointInsideEllipse(localX, localY, shape.bounds, seatLayout.seatRadius)
      ) {
        continue;
      }

      const seatNumber = String(seatLayout.seatStartNumber + seatIndex);
      const seatKey = `${rowName}::${seatNumber}`;
      const existingSeat = existingSeatMap.get(seatKey);
      nextSeats.push({
        id: existingSeat?.id ?? crypto.randomUUID(),
        label: buildSeatLabel(rowName, seatNumber),
        rowName,
        seatNumber,
        ticketTypeId: existingSeat?.ticketTypeId,
        colorCode: existingSeat?.colorCode,
        seatType: existingSeat?.seatType,
        x: shape.bounds.x + localX,
        y: shape.bounds.y + localY,
        inventoryStatus: existingSeat?.inventoryStatus,
        hidden: false,
        manualAdjusted: false,
      });
    }
  }

  return {
    ...shape,
    sectorType: GENERATED_SEAT_SECTOR_TYPE,
    seatLayout,
    seats: nextSeats,
    seatCount: getVisibleSeatCount(nextSeats),
  };
}

export function moveSeatWithinShape(
  shape: SeatMapEditorShape,
  seatId: string,
  nextX: number,
  nextY: number,
): SeatMapEditorShape {
  const nextSeats = shape.seats.map((seat) =>
    seat.id === seatId
      ? {
          ...seat,
          x: nextX,
          y: nextY,
          manualAdjusted: true,
        }
      : seat,
  );

  return {
    ...shape,
    seats: nextSeats,
    seatCount: getVisibleSeatCount(nextSeats),
  };
}

export function setSeatHiddenState(
  shape: SeatMapEditorShape,
  seatId: string,
  hidden: boolean,
): SeatMapEditorShape {
  const nextSeats = shape.seats.map((seat) =>
    seat.id === seatId
      ? {
          ...seat,
          hidden,
        }
      : seat,
  );

  return {
    ...shape,
    seats: nextSeats,
    seatCount: getVisibleSeatCount(nextSeats),
  };
}

export function restoreHiddenSeats(shape: SeatMapEditorShape): SeatMapEditorShape {
  const nextSeats = shape.seats.map((seat) => ({
    ...seat,
    hidden: false,
  }));

  return {
    ...shape,
    seats: nextSeats,
    seatCount: getVisibleSeatCount(nextSeats),
  };
}

export function createRectangleShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  const width = Math.max(Math.round(document.width * 0.18), 180);
  const height = Math.max(Math.round(document.height * 0.16), 120);
  const bounds = {
    x: 80 + (index % 3) * 48,
    y: 80 + (index % 4) * 40,
    width,
    height,
  };

  return {
    id: crypto.randomUUID(),
    sectorId: crypto.randomUUID(),
    name: `Sector ${index + 1}`,
    sectorType: "STANDING",
    totalCapacity: 0,
    shapeType: "rectangle",
    mapData: { shapeType: "rectangle", bounds },
    color: DEFAULT_SECTOR_COLORS[index % DEFAULT_SECTOR_COLORS.length],
    bounds,
    points: [],
    label: `Sector ${index + 1}`,
    seatCount: 0,
    seats: [],
    seatLayout: buildDefaultSeatLayoutConfig(bounds),
    visible: true,
    locked: false,
    zIndex: index,
  };
}

function createPolygonPresetShape(
  index: number,
  document: SeatMapEditorDocument,
  namePrefix: string,
  pointsFactory: (width: number, height: number) => number[],
  offsetX = 120,
  offsetY = 120,
  stepX = 56,
  stepY = 48,
): SeatMapEditorShape {
  const width = Math.max(Math.round(document.width * 0.18), 180);
  const height = Math.max(Math.round(document.height * 0.16), 120);
  const bounds = {
    x: offsetX + (index % 3) * stepX,
    y: offsetY + (index % 4) * stepY,
    width,
    height,
  };

  return {
    id: crypto.randomUUID(),
    sectorId: crypto.randomUUID(),
    name: `${namePrefix} ${index + 1}`,
    sectorType: "STANDING",
    totalCapacity: 0,
    shapeType: "polygon",
    mapData: { shapeType: "polygon", bounds },
    color: DEFAULT_SECTOR_COLORS[index % DEFAULT_SECTOR_COLORS.length],
    bounds,
    points: pointsFactory(width, height),
    label: `${namePrefix} ${index + 1}`,
    seatCount: 0,
    seats: [],
    seatLayout: buildDefaultSeatLayoutConfig(bounds),
    visible: true,
    locked: false,
    zIndex: index,
  };
}

export function createPolygonShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  return createPolygonPresetShape(index, document, "Polygon", (width, height) => [
    width * 0.08,
    height * 0.18,
    width * 0.84,
    0,
    width,
    height * 0.54,
    width * 0.74,
    height,
    0,
    height * 0.76,
  ]);
}

export function createCircleShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  const size = Math.max(Math.round(Math.min(document.width, document.height) * 0.14), 140);
  const bounds = {
    x: 156 + (index % 3) * 52,
    y: 132 + (index % 4) * 44,
    width: size,
    height: size,
  };

  return {
    id: crypto.randomUUID(),
    sectorId: crypto.randomUUID(),
    name: `Circle ${index + 1}`,
    sectorType: "STANDING",
    totalCapacity: 0,
    shapeType: "circle",
    mapData: { shapeType: "circle", bounds },
    color: DEFAULT_SECTOR_COLORS[index % DEFAULT_SECTOR_COLORS.length],
    bounds,
    points: [],
    label: `Circle ${index + 1}`,
    seatCount: 0,
    seats: [],
    seatLayout: buildDefaultSeatLayoutConfig(bounds),
    visible: true,
    locked: false,
    zIndex: index,
  };
}

export function createEllipseShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  const bounds = {
    x: 168 + (index % 3) * 50,
    y: 144 + (index % 4) * 42,
    width: Math.max(Math.round(document.width * 0.18), 180),
    height: Math.max(Math.round(document.height * 0.13), 110),
  };

  return {
    id: crypto.randomUUID(),
    sectorId: crypto.randomUUID(),
    name: `Ellipse ${index + 1}`,
    sectorType: "STANDING",
    totalCapacity: 0,
    shapeType: "ellipse",
    mapData: { shapeType: "ellipse", bounds },
    color: DEFAULT_SECTOR_COLORS[index % DEFAULT_SECTOR_COLORS.length],
    bounds,
    points: [],
    label: `Ellipse ${index + 1}`,
    seatCount: 0,
    seats: [],
    seatLayout: buildDefaultSeatLayoutConfig(bounds),
    visible: true,
    locked: false,
    zIndex: index,
  };
}

export function createTrapezoidShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  return createPolygonPresetShape(index, document, "Trapezoid", (width, height) => [
    width * 0.18,
    0,
    width * 0.82,
    0,
    width,
    height,
    0,
    height,
  ], 132, 108, 52, 44);
}

export function createDiamondShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  return createPolygonPresetShape(index, document, "Diamond", (width, height) => [
    width * 0.5,
    0,
    width,
    height * 0.5,
    width * 0.5,
    height,
    0,
    height * 0.5,
  ], 140, 118, 50, 42);
}

export function createHexagonShape(
  index: number,
  document: SeatMapEditorDocument,
): SeatMapEditorShape {
  return createPolygonPresetShape(index, document, "Hexagon", (width, height) => [
    width * 0.22,
    0,
    width * 0.78,
    0,
    width,
    height * 0.5,
    width * 0.78,
    height,
    width * 0.22,
    height,
    0,
    height * 0.5,
  ], 148, 124, 46, 40);
}

export function serializeEditorDocument(document: SeatMapEditorDocument) {
  return JSON.stringify({
    version: DRAFT_VERSION,
    document,
  });
}

function normalizeParsedEditorDocument(parsed: unknown): SeatMapEditorDocument | null {
  try {
    const candidate = parsed as {
      version?: number;
      document?: SeatMapEditorDocument;
      seatMapEditorDocument?: SeatMapEditorDocument;
    };
    const documentSource =
      candidate.version === DRAFT_VERSION
        ? candidate.document
        : candidate.seatMapEditorDocument ?? candidate.document;

    if (!documentSource) {
      return null;
    }

    return {
      width: Math.max(asNumber(documentSource.width) ?? DEFAULT_CANVAS_WIDTH, 640),
      height: Math.max(asNumber(documentSource.height) ?? DEFAULT_CANVAS_HEIGHT, 420),
      referenceImageUrl: documentSource.referenceImageUrl,
      shapes: sortShapesByZIndex(
        (documentSource.shapes ?? []).map((shape, index) => {
          const bounds = {
            x: asNumber(shape.bounds?.x) ?? 0,
            y: asNumber(shape.bounds?.y) ?? 0,
            width: Math.max(asNumber(shape.bounds?.width) ?? 1, 1),
            height: Math.max(asNumber(shape.bounds?.height) ?? 1, 1),
          };
          const seats = Array.isArray(shape.seats)
            ? shape.seats.map((seat) => ({
                ...seat,
                x: asNumber(seat.x) ?? 0,
                y: asNumber(seat.y) ?? 0,
                hidden: seat.hidden === true,
                manualAdjusted: seat.manualAdjusted === true,
              }))
            : [];

          return {
            ...shape,
            sectorType: normalizeSectorType(shape.sectorType, seats.length),
            totalCapacity: asNumber(shape.totalCapacity ?? shape.mapData?.totalCapacity) ?? undefined,
            mapData: shape.mapData,
            visible: shape.visible !== false,
            locked: shape.locked === true,
            zIndex: asNumber(shape.zIndex) ?? index,
            bounds,
            points: Array.isArray(shape.points)
              ? shape.points.filter((point) => typeof point === "number")
              : [],
            seats,
            seatCount: getVisibleSeatCount(seats),
            seatLayout: normalizeSeatLayoutConfig(shape.seatLayout, bounds, seats.length),
          };
        }),
      ),
    };
  } catch {
    return null;
  }
}

export function deserializeEditorDocument(rawValue: string): SeatMapEditorDocument | null {
  try {
    return normalizeParsedEditorDocument(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function exportEditorDocument(document: SeatMapEditorDocument) {
  return JSON.stringify(
    {
      version: DRAFT_VERSION,
      exportedAt: new Date().toISOString(),
      seatMapEditorDocument: document,
    },
    null,
    2,
  );
}

export function importEditorDocument(rawValue: string): SeatMapEditorDocument | null {
  try {
    return normalizeParsedEditorDocument(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function buildSeatMapPublishPayload(
  document: SeatMapEditorDocument,
  options?: {
    name?: string;
    backgroundPublicId?: string;
    mapConfig?: Record<string, unknown>;
  },
): OrganizerSeatMapPublishPayload {
  return {
    name: options?.name,
    backgroundImageUrl: document.referenceImageUrl,
    backgroundPublicId: options?.backgroundPublicId,
    backgroundWidth: document.width,
    backgroundHeight: document.height,
    mapConfig: {
      ...(options?.mapConfig ?? {}),
      schemaVersion: 1,
      runtime: {
        renderMode: "vector-first",
        backgroundVisible: false,
      },
    },
    sectors: sortShapesByZIndex(document.shapes).map((shape, index) => {
      const sectorType = normalizeSectorType(shape.sectorType, shape.seats.length);
      const publishedSeats = sectorType === "SEATED" ? shape.seats : [];

      return {
      id: shape.id,
      name: shape.name,
      code: shape.code,
      sectorType,
      totalCapacity:
        sectorType === "STANDING"
          ? Math.max(0, Math.round(asNumber(shape.totalCapacity) ?? 0))
          : getVisibleSeatCount(shape.seats),
      colorCode: shape.color,
      visible: shape.visible,
      displayOrder: index,
      mapData: {
        ...(shape.mapData ?? {}),
        shapeType: shape.shapeType,
        bounds: shape.bounds,
        points:
          shape.shapeType === "polygon"
            ? shape.points.map((point, pointIndex) =>
                pointIndex % 2 === 0 ? point + shape.bounds.x : point + shape.bounds.y,
              )
            : [],
        label: shape.label,
        sectorType,
        totalCapacity:
          sectorType === "STANDING"
            ? Math.max(0, Math.round(asNumber(shape.totalCapacity) ?? 0))
            : getVisibleSeatCount(shape.seats),
        zIndex: shape.zIndex,
        visible: shape.visible,
        locked: shape.locked,
        seatLayout: shape.seatLayout,
      },
      seats: publishedSeats.map((seat) => ({
        id: seat.id,
        rowName: seat.rowName,
        seatNumber: seat.seatNumber,
        seatLabel: seat.label,
        coordX: Number(seat.x.toFixed(2)),
        coordY: Number(seat.y.toFixed(2)),
        ticketTypeId: sectorType === "SEATED" ? seat.ticketTypeId : undefined,
        colorCode: sectorType === "SEATED" ? (seat.colorCode ?? undefined) : undefined,
        isActive: seat.hidden !== true,
        coordMetadata: {
          shapeId: shape.id,
          hidden: seat.hidden === true,
          manualAdjusted: seat.manualAdjusted === true,
          relativeX: Number(((seat.x - shape.bounds.x) / Math.max(shape.bounds.width, 1)).toFixed(4)),
          relativeY: Number(((seat.y - shape.bounds.y) / Math.max(shape.bounds.height, 1)).toFixed(4)),
          seatRadius: shape.seatLayout.seatRadius,
        },
      })),
      };
    }),
  };
}
