import { polarToCartesian } from "./sectorPathUtils";

export interface ArcSeatParams {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  count: number;
}

export interface RingSeatParams {
  cx: number;
  cy: number;
  startRadius: number;
  rowSpacing: number;
  rows: number;
  startAngle: number;
  endAngle: number;
  seatsPerRow: number;
}

export interface GeneratedSeatPoint {
  x: number;
  y: number;
  rowIndex: number;
  seatIndex: number;
}

export function generateArcSeats(params: ArcSeatParams): GeneratedSeatPoint[] {
  const count = Math.max(0, Math.round(params.count));
  if (count === 0) {
    return [];
  }

  const step = count === 1 ? 0 : (params.endAngle - params.startAngle) / (count - 1);
  return Array.from({ length: count }, (_, seatIndex) => {
    const point = polarToCartesian(params.cx, params.cy, params.radius, params.startAngle + step * seatIndex);
    return {
      ...point,
      rowIndex: 0,
      seatIndex,
    };
  });
}

export function generateRingSeats(params: RingSeatParams): GeneratedSeatPoint[] {
  const rows = Math.max(0, Math.round(params.rows));
  const seatsPerRow = Math.max(0, Math.round(params.seatsPerRow));
  const points: GeneratedSeatPoint[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const radius = params.startRadius + rowIndex * params.rowSpacing;
    const rowSeats = generateArcSeats({
      cx: params.cx,
      cy: params.cy,
      radius,
      startAngle: params.startAngle,
      endAngle: params.endAngle,
      count: seatsPerRow,
    });

    rowSeats.forEach((seat) => {
      points.push({
        ...seat,
        rowIndex,
      });
    });
  }

  return points;
}
