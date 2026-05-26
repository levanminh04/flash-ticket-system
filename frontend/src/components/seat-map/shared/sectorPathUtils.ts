export interface RingSectorPathParams {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}

export interface FanSectorPathParams {
  cx: number;
  cy: number;
  innerRadius?: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}

export interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function normalizeArcDelta(startAngle: number, endAngle: number) {
  const delta = Math.abs(endAngle - startAngle) % 360;
  return delta === 0 ? 359.99 : delta;
}

export function createRingSectorPath(params: RingSectorPathParams) {
  const innerRadius = Math.max(params.innerRadius, 0);
  const outerRadius = Math.max(params.outerRadius, innerRadius + 1);
  const arcDelta = normalizeArcDelta(params.startAngle, params.endAngle);
  const largeArcFlag = arcDelta > 180 ? 1 : 0;
  const sweepFlag = params.endAngle >= params.startAngle ? 1 : 0;
  const innerSweepFlag = sweepFlag ? 0 : 1;

  const outerStart = polarToCartesian(params.cx, params.cy, outerRadius, params.startAngle);
  const outerEnd = polarToCartesian(params.cx, params.cy, outerRadius, params.endAngle);
  const innerEnd = polarToCartesian(params.cx, params.cy, innerRadius, params.endAngle);
  const innerStart = polarToCartesian(params.cx, params.cy, innerRadius, params.startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} ${sweepFlag} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${innerSweepFlag} ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export function createFanSectorPath(params: FanSectorPathParams) {
  const innerRadius = Math.max(params.innerRadius ?? 0, 0);

  if (innerRadius <= 0) {
    const outerStart = polarToCartesian(params.cx, params.cy, params.outerRadius, params.startAngle);
    const outerEnd = polarToCartesian(params.cx, params.cy, params.outerRadius, params.endAngle);
    const arcDelta = normalizeArcDelta(params.startAngle, params.endAngle);
    const largeArcFlag = arcDelta > 180 ? 1 : 0;
    const sweepFlag = params.endAngle >= params.startAngle ? 1 : 0;

    return [
      `M ${params.cx} ${params.cy}`,
      `L ${outerStart.x} ${outerStart.y}`,
      `A ${params.outerRadius} ${params.outerRadius} 0 ${largeArcFlag} ${sweepFlag} ${outerEnd.x} ${outerEnd.y}`,
      "Z",
    ].join(" ");
  }

  return createRingSectorPath({
    ...params,
    innerRadius,
  });
}

export function createRoundedRectPath(bounds: BoundsLike, cornerRadius: number) {
  const radius = Math.max(0, Math.min(cornerRadius, bounds.width / 2, bounds.height / 2));
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  return [
    `M ${bounds.x + radius} ${bounds.y}`,
    `L ${right - radius} ${bounds.y}`,
    `Q ${right} ${bounds.y} ${right} ${bounds.y + radius}`,
    `L ${right} ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `L ${bounds.x + radius} ${bottom}`,
    `Q ${bounds.x} ${bottom} ${bounds.x} ${bottom - radius}`,
    `L ${bounds.x} ${bounds.y + radius}`,
    `Q ${bounds.x} ${bounds.y} ${bounds.x + radius} ${bounds.y}`,
    "Z",
  ].join(" ");
}

export function getBoundsFromPoints(points: number[]): BoundsLike | null {
  if (points.length < 2 || points.length % 2 !== 0) {
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
