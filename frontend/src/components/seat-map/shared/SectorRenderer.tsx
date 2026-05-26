import { useMemo } from "react";
import { Ellipse, Group, Line, Path, Rect, Text } from "react-konva";
import {
  asNumber,
  BoundsLike,
  createFanSectorPath,
  createRingSectorPath,
  createRoundedRectPath,
  getBoundsFromPoints,
} from "./sectorPathUtils";
import { resolveSectorStylePreset } from "./sectorStylePresets";

export type SharedSectorShapeType =
  | "rect"
  | "rectangle"
  | "roundedRect"
  | "ellipse"
  | "polygon"
  | "path"
  | "ringSection"
  | "fan"
  | "stage"
  | "foh";

export interface SharedSector {
  id: string;
  name?: string;
  label?: string;
  colorCode?: string;
  color?: string;
  shapeType?: string;
  sectorType?: string;
  bounds?: BoundsLike;
  points?: number[];
  mapData?: Record<string, unknown>;
}

interface SectorRendererProps {
  sector: SharedSector;
  selected?: boolean;
  hovered?: boolean;
  draggable?: boolean;
  pointsAreRelative?: boolean;
  showDepth?: boolean;
  showLabel?: boolean;
  listening?: boolean;
  nodeRef?: (node: any) => void;
  onClick?: (event: any) => void;
  onTap?: (event: any) => void;
  onDragStart?: (event: any) => void;
  onDragEnd?: (event: any) => void;
  onTransformEnd?: (event: any) => void;
  onMouseEnter?: (event: any) => void;
  onMouseLeave?: (event: any) => void;
}

function getMapDataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getBounds(sector: SharedSector): BoundsLike {
  const mapData = getMapDataObject(sector.mapData);
  const rawBounds = getMapDataObject(mapData.bounds);
  const x = asNumber(sector.bounds?.x ?? rawBounds.x ?? mapData.x) ?? 0;
  const y = asNumber(sector.bounds?.y ?? rawBounds.y ?? mapData.y) ?? 0;
  const width = Math.max(asNumber(sector.bounds?.width ?? rawBounds.width ?? mapData.width) ?? 180, 1);
  const height = Math.max(asNumber(sector.bounds?.height ?? rawBounds.height ?? mapData.height) ?? 120, 1);

  return { x, y, width, height };
}

function getPoints(sector: SharedSector, bounds: BoundsLike, pointsAreRelative?: boolean) {
  const mapData = getMapDataObject(sector.mapData);
  const rawPoints = Array.isArray(sector.points) && sector.points.length ? sector.points : mapData.points;

  if (!Array.isArray(rawPoints)) {
    return [];
  }

  const points = rawPoints
    .flatMap((point) => {
      if (typeof point === "number") {
        return [point];
      }
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
      return [];
    })
    .filter((point): point is number => typeof point === "number" && Number.isFinite(point));

  if (!pointsAreRelative) {
    return points;
  }

  return points.map((point, index) => (index % 2 === 0 ? point + bounds.x : point + bounds.y));
}

function normalizeShapeType(sector: SharedSector): SharedSectorShapeType {
  const mapData = getMapDataObject(sector.mapData);
  const raw = String(mapData.shapeType ?? sector.shapeType ?? "rect");

  if (raw === "rectangle") {
    return "rect";
  }
  if (raw === "circle") {
    return "ellipse";
  }
  if (
    raw === "rect" ||
    raw === "roundedRect" ||
    raw === "ellipse" ||
    raw === "polygon" ||
    raw === "path" ||
    raw === "ringSection" ||
    raw === "fan" ||
    raw === "stage" ||
    raw === "foh"
  ) {
    return raw;
  }

  return "rect";
}

function getLabelConfig(sector: SharedSector, bounds: BoundsLike) {
  const mapData = getMapDataObject(sector.mapData);
  const labelPosition = getMapDataObject(mapData.labelPosition);
  const x = asNumber(labelPosition.x) ?? bounds.x + bounds.width / 2;
  const y = asNumber(labelPosition.y) ?? bounds.y + bounds.height / 2;

  return {
    x,
    y,
    width: Math.max(asNumber(mapData.labelWidth) ?? Math.min(bounds.width * 0.86, 220), 48),
    rotation: asNumber(mapData.labelRotation) ?? 0,
    align: mapData.labelAlign === "left" || mapData.labelAlign === "right" ? mapData.labelAlign : "center",
  };
}

function getPathData(sector: SharedSector, shapeType: SharedSectorShapeType, bounds: BoundsLike, points: number[]) {
  const mapData = getMapDataObject(sector.mapData);
  const pathData = typeof mapData.pathData === "string" ? mapData.pathData : undefined;

  if (shapeType === "path" && pathData) {
    return pathData;
  }

  if (shapeType === "ringSection") {
    const cx = asNumber(mapData.cx) ?? bounds.x + bounds.width / 2;
    const cy = asNumber(mapData.cy) ?? bounds.y + bounds.height / 2;
    const outerRadius = Math.max(asNumber(mapData.outerRadius) ?? Math.max(bounds.width, bounds.height) / 2, 1);
    const innerRadius = Math.max(asNumber(mapData.innerRadius) ?? outerRadius * 0.72, 0);
    const startAngle = asNumber(mapData.startAngle) ?? -70;
    const endAngle = asNumber(mapData.endAngle) ?? 70;

    return createRingSectorPath({ cx, cy, innerRadius, outerRadius, startAngle, endAngle });
  }

  if (shapeType === "fan") {
    const cx = asNumber(mapData.cx) ?? bounds.x + bounds.width / 2;
    const cy = asNumber(mapData.cy) ?? bounds.y + bounds.height;
    const outerRadius = Math.max(asNumber(mapData.outerRadius) ?? Math.max(bounds.width, bounds.height), 1);
    const innerRadius = Math.max(asNumber(mapData.innerRadius) ?? 0, 0);
    const startAngle = asNumber(mapData.startAngle) ?? -45;
    const endAngle = asNumber(mapData.endAngle) ?? 45;

    return createFanSectorPath({ cx, cy, innerRadius, outerRadius, startAngle, endAngle });
  }

  if (shapeType === "stage" || shapeType === "foh" || shapeType === "roundedRect") {
    const cornerRadius = asNumber(mapData.cornerRadius) ?? (shapeType === "foh" ? 10 : 24);
    return createRoundedRectPath(bounds, cornerRadius);
  }

  if (shapeType === "polygon" && points.length >= 6) {
    return points.reduce((path, point, index) => {
      if (index % 2 !== 0) {
        return path;
      }
      const command = index === 0 ? "M" : "L";
      return `${path} ${command} ${point} ${points[index + 1]}`;
    }, "").trim() + " Z";
  }

  return undefined;
}

export function SectorRenderer({
  sector,
  selected = false,
  hovered = false,
  draggable = false,
  pointsAreRelative = false,
  showDepth = true,
  showLabel = true,
  listening = true,
  nodeRef,
  onClick,
  onTap,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onMouseEnter,
  onMouseLeave,
}: SectorRendererProps) {
  const bounds = getBounds(sector);
  const shapeType = normalizeShapeType(sector);
  const points = getPoints(sector, bounds, pointsAreRelative);
  const style = resolveSectorStylePreset(getMapDataObject(sector.mapData).stylePreset);
  const pathData = useMemo(
    () => getPathData(sector, shapeType, bounds, points),
    [bounds.height, bounds.width, bounds.x, bounds.y, points, sector, shapeType],
  );
  const labelConfig = getLabelConfig(sector, bounds);
  const stroke = selected ? "#ffffff" : hovered ? "#bae6fd" : sector.colorCode ?? sector.color ?? style.stroke;
  const fill = getMapDataObject(sector.mapData).fill
    ? String(getMapDataObject(sector.mapData).fill)
    : shapeType === "stage" || shapeType === "foh"
      ? style.fill
      : `${sector.colorCode ?? sector.color ?? style.stroke}30`;
  const strokeWidth = selected ? style.strokeWidth + 1.5 : hovered ? style.strokeWidth + 0.75 : style.strokeWidth;

  const commonProps = {
    ref: nodeRef,
    name: "shape-node",
    draggable,
    listening,
    fill,
    stroke,
    strokeWidth,
    shadowColor: style.shadowColor,
    shadowBlur: style.shadowBlur,
    shadowOpacity: selected ? Math.min(style.shadowOpacity + 0.12, 0.5) : style.shadowOpacity,
    shadowOffset: { x: style.shadowOffsetX, y: style.shadowOffsetY },
    opacity: hovered ? 0.96 : 1,
    onClick,
    onTap,
    onDragStart,
    onDragEnd,
    onTransformEnd,
    onMouseEnter,
    onMouseLeave,
  };

  const label = sector.label ?? sector.name;

  return (
    <Group>
      {showDepth && pathData ? (
        <Path data={pathData} x={0} y={7} fill="#000000" opacity={0.14} listening={false} />
      ) : null}

      {shapeType === "ellipse" ? (
        <Ellipse
          {...commonProps}
          x={bounds.x + bounds.width / 2}
          y={bounds.y + bounds.height / 2}
          radiusX={bounds.width / 2}
          radiusY={bounds.height / 2}
        />
      ) : shapeType === "rect" && !pathData ? (
        <Rect {...commonProps} x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} cornerRadius={20} />
      ) : shapeType === "polygon" && points.length >= 6 ? (
        <Line {...commonProps} points={points} closed />
      ) : pathData ? (
        <Path {...commonProps} data={pathData} />
      ) : (
        <Rect {...commonProps} x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} cornerRadius={20} />
      )}

      {showLabel && label ? (
        <Text
          x={labelConfig.x - labelConfig.width / 2}
          y={labelConfig.y - style.labelFontSize / 2}
          width={labelConfig.width}
          text={label}
          align={labelConfig.align}
          rotation={labelConfig.rotation}
          fill={style.labelColor}
          fontSize={style.labelFontSize}
          fontStyle={style.labelFontWeight === "bold" ? "700" : "400"}
          listening={false}
          shadowColor="rgba(0, 0, 0, 0.42)"
          shadowBlur={3}
          shadowOpacity={0.7}
        />
      ) : null}
    </Group>
  );
}

export function getSectorRendererBounds(sector: SharedSector, pointsAreRelative = false): BoundsLike {
  const bounds = getBounds(sector);
  const shapeType = normalizeShapeType(sector);
  const points = getPoints(sector, bounds, pointsAreRelative);
  if (shapeType === "polygon") {
    return getBoundsFromPoints(points) ?? bounds;
  }
  return bounds;
}
