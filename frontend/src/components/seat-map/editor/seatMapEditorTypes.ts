export type SeatMapEditorShapeType = "rectangle" | "polygon" | "circle" | "ellipse";
export type SeatMapEditorTool = "select" | "rectangle" | "polygon";

export interface SeatMapEditorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SeatMapEditorSeatLayoutConfig {
  rows: number;
  seatsPerRow: number;
  gapX: number;
  gapY: number;
  paddingX: number;
  paddingY: number;
  offsetX: number;
  offsetY: number;
  seatRadius: number;
  rowStartCharCode: number;
  seatStartNumber: number;
}

export interface SeatMapEditorSeat {
  id: string;
  label: string;
  rowName?: string;
  seatNumber?: string;
  seatType?: string; // Standard, VIP, etc
  x: number;
  y: number;
  inventoryStatus?: string;
  hidden?: boolean;
  manualAdjusted?: boolean;
}

export interface SeatMapEditorShape {
  id: string;
  sectorId: string;
  name: string;
  code?: string;
  ticketTypeId?: string;
  ticketTypeName?: string;
  shapeType: SeatMapEditorShapeType;
  color: string;
  bounds: SeatMapEditorBounds;
  points: number[];
  label: string;
  seatCount: number;
  seats: SeatMapEditorSeat[];
  seatLayout: SeatMapEditorSeatLayoutConfig;
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

export interface SeatMapEditorViewport {
  scale: number;
  x: number;
  y: number;
}

export interface SeatMapEditorDocument {
  width: number;
  height: number;
  referenceImageUrl?: string;
  shapes: SeatMapEditorShape[];
}
