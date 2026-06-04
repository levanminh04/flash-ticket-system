import {
  SeatMapEditorBounds,
  SeatMapEditorDocument,
  SeatMapEditorShape,
} from "../editor/seatMapEditorTypes";
import { createClientId } from "./idUtils";

const PRESET_COLORS = {
  stage: "#64748b",
  foh: "#94a3b8",
  vip: "#f59e0b",
  cat1: "#22c55e",
  cat2: "#3b82f6",
  cat3: "#a855f7",
  cat4: "#f97316",
  cat5: "#14b8a6",
};

function defaultSeatLayout(bounds: SeatMapEditorBounds) {
  return {
    mode: "grid" as const,
    rows: 4,
    seatsPerRow: 8,
    gapX: Math.max(18, bounds.width / 10),
    gapY: Math.max(18, bounds.height / 7),
    paddingX: Math.max(12, bounds.width * 0.08),
    paddingY: Math.max(12, bounds.height * 0.16),
    offsetX: 0,
    offsetY: 0,
    seatRadius: 6,
    rowStartCharCode: "A".charCodeAt(0),
    seatStartNumber: 1,
  };
}

function createBaseShape(
  name: string,
  shapeType: SeatMapEditorShape["shapeType"],
  bounds: SeatMapEditorBounds,
  color: string,
  zIndex: number,
  mapData: Record<string, unknown>,
): SeatMapEditorShape {
  return {
    id: createClientId(),
    sectorId: createClientId(),
    name,
    sectorType: shapeType === "stage" || shapeType === "foh" ? "STANDING" : "SEATED",
    shapeType,
    mapData: {
      ...mapData,
      shapeType,
      bounds,
    },
    color,
    bounds,
    points: [],
    label: name,
    seatCount: 0,
    seats: [],
    seatLayout: defaultSeatLayout(bounds),
    visible: true,
    locked: false,
    zIndex,
  };
}

function createTemplateShape({
  name,
  code,
  shapeType,
  sectorType,
  totalCapacity,
  bounds,
  color,
  zIndex,
  mapData,
}: {
  name: string;
  code?: string;
  shapeType: SeatMapEditorShape["shapeType"];
  sectorType: SeatMapEditorShape["sectorType"];
  totalCapacity?: number;
  bounds: SeatMapEditorBounds;
  color: string;
  zIndex: number;
  mapData: Record<string, unknown>;
}): SeatMapEditorShape {
  return {
    id: createClientId(),
    sectorId: createClientId(),
    name,
    code,
    sectorType,
    totalCapacity,
    shapeType,
    mapData: {
      ...mapData,
      code,
      shapeType,
      bounds,
    },
    color,
    bounds,
    points: [],
    label: name,
    seatCount: 0,
    seats: [],
    seatLayout: defaultSeatLayout(bounds),
    visible: true,
    locked: false,
    zIndex,
  };
}

function nextZIndex(document: SeatMapEditorDocument) {
  return document.shapes.length;
}

export function createConcertOvalTemplate(document: SeatMapEditorDocument): SeatMapEditorShape[] {
  const width = Math.max(document.width || 1000, 640);
  const height = Math.max(document.height || 760, 420);
  const cx = width / 2;
  const cy = height * 0.38;
  const outerLarge = Math.min(width * 0.29, height * 0.36, 430);
  const outerInner = Math.min(width * 0.21, height * 0.28, 310);
  const outerBottom = Math.min(width * 0.27, height * 0.34, 410);
  const innerLarge = outerLarge * 0.77;
  const innerInner = outerInner * 0.79;
  const innerBottom = outerBottom * 0.78;
  let zIndex = nextZIndex(document);

  const rounded = (
    name: string,
    code: string,
    bounds: SeatMapEditorBounds,
    color: string,
    cornerRadius = 10,
  ) =>
    createTemplateShape({
      name,
      code,
      shapeType: "roundedRect",
      sectorType: "SEATED",
      bounds,
      color,
      zIndex: zIndex++,
      mapData: {
        stylePreset: "cat2",
        cornerRadius,
        fill: color,
        labelPosition: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        labelWidth: bounds.width * 0.9,
      },
    });

  const ring = (
    name: string,
    code: string,
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number,
    color: string,
    labelX: number,
    labelY: number,
  ) => {
    const bounds = {
      x: cx - outerRadius,
      y: cy - outerRadius,
      width: outerRadius * 2,
      height: outerRadius * 2,
    };

    return createTemplateShape({
      name,
      code,
      shapeType: "ringSection",
      sectorType: "SEATED",
      bounds,
      color,
      zIndex: zIndex++,
      mapData: {
        stylePreset: "cat2",
        cx,
        cy,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        fill: color,
        labelPosition: { x: labelX, y: labelY },
        labelWidth: 130,
      },
    });
  };

  const decorative = (
    name: string,
    code: string,
    shapeType: "stage" | "foh",
    bounds: SeatMapEditorBounds,
    color: string,
    cornerRadius = 10,
  ) =>
    createTemplateShape({
      name,
      code,
      shapeType,
      sectorType: "SEATED",
      bounds,
      color,
      zIndex: zIndex++,
      mapData: {
        stylePreset: shapeType,
        cornerRadius,
        fill: color,
        labelPosition: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        labelWidth: bounds.width,
        decorative: true,
      },
    });

  const blockWidth = Math.min(width * 0.1, height * 0.22, 150);
  const blockHeight = Math.min(height * 0.13, 94);
  const blockGap = Math.max(8, Math.min(width * 0.01, 14));
  const blockStartX = cx - blockWidth - blockGap / 2;
  const blockStartY = Math.min(cy + height * 0.08, height - blockHeight * 2 - blockGap - 40);

  return [
    ring("CAT 5", "CAT5", -118, -78, innerLarge, outerLarge, "#f472b6", cx - outerLarge * 1.18, cy),
    ring("CAT 3", "CAT3", -102, -72, innerInner, outerInner, "#facc15", cx - outerInner * 1.08, cy),
    ring("CAT 4", "CAT4", 72, 102, innerInner, outerInner, "#facc15", cx + outerInner * 1.08, cy),
    ring("CAT 6", "CAT6", 78, 118, innerLarge, outerLarge, "#f472b6", cx + outerLarge * 1.18, cy),
    ring("CAT 7", "CAT7", -172, -132, innerBottom, outerBottom, "#b36cf2", cx - outerBottom * 0.56, cy + outerBottom * 0.78),
    ring("CAT 8", "CAT8", 132, 172, innerBottom, outerBottom, "#b36cf2", cx + outerBottom * 0.56, cy + outerBottom * 0.78),
    rounded("VIP 1", "VIP1", {
      x: blockStartX,
      y: blockStartY - blockHeight - blockGap,
      width: blockWidth,
      height: blockHeight,
    }, "#2563eb"),
    rounded("VIP 2", "VIP2", {
      x: blockStartX + blockWidth + blockGap,
      y: blockStartY - blockHeight - blockGap,
      width: blockWidth,
      height: blockHeight,
    }, "#2563eb"),
    rounded("CAT 1", "CAT1", {
      x: blockStartX,
      y: blockStartY,
      width: blockWidth,
      height: blockHeight,
    }, "#9cf312"),
    rounded("CAT 2", "CAT2", {
      x: blockStartX + blockWidth + blockGap,
      y: blockStartY,
      width: blockWidth,
      height: blockHeight,
    }, "#9cf312"),
    decorative("STAGE", "STAGE", "stage", {
      x: cx - blockWidth * 0.75,
      y: Math.max(24, blockStartY - blockHeight * 2.25),
      width: blockWidth * 1.5,
      height: Math.min(74, height * 0.12),
    }, "#a3a3a3", 4),
    decorative("FOH", "FOH", "foh", {
      x: cx - 24,
      y: Math.min(height - 38, blockStartY + blockHeight + 14),
      width: 48,
      height: 28,
    }, "#a3a3a3", 3),
  ];
}

export function createStagePreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const width = Math.min(document.width * 0.48, 560);
  const height = 86;
  const bounds = {
    x: document.width / 2 - width / 2,
    y: 42,
    width,
    height,
  };

  return createBaseShape("Stage", "stage", bounds, PRESET_COLORS.stage, nextZIndex(document), {
    stylePreset: "stage",
    cornerRadius: 22,
    labelPosition: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    labelWidth: bounds.width * 0.8,
  });
}

export function createFohPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const bounds = {
    x: document.width / 2 - 54,
    y: Math.min(document.height * 0.48, 420),
    width: 108,
    height: 54,
  };

  return createBaseShape("FOH", "foh", bounds, PRESET_COLORS.foh, nextZIndex(document), {
    stylePreset: "foh",
    cornerRadius: 12,
    labelPosition: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    labelWidth: bounds.width,
  });
}

export function createVipLeftCurvedPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const cx = document.width / 2;
  const cy = 130;
  const outerRadius = Math.min(document.width * 0.34, 410);
  const innerRadius = outerRadius * 0.72;
  const bounds = {
    x: cx - outerRadius,
    y: cy - outerRadius,
    width: outerRadius,
    height: outerRadius * 1.25,
  };

  return createBaseShape("VIP Left", "ringSection", bounds, PRESET_COLORS.vip, nextZIndex(document), {
    stylePreset: "vip",
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle: -116,
    endAngle: -32,
    labelPosition: { x: cx - outerRadius * 0.55, y: cy + outerRadius * 0.42 },
    labelWidth: 120,
  });
}

export function createVipRightCurvedPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const cx = document.width / 2;
  const cy = 130;
  const outerRadius = Math.min(document.width * 0.34, 410);
  const innerRadius = outerRadius * 0.72;
  const bounds = {
    x: cx,
    y: cy - outerRadius,
    width: outerRadius,
    height: outerRadius * 1.25,
  };

  return createBaseShape("VIP Right", "ringSection", bounds, PRESET_COLORS.vip, nextZIndex(document), {
    stylePreset: "vip",
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle: 32,
    endAngle: 116,
    labelPosition: { x: cx + outerRadius * 0.55, y: cy + outerRadius * 0.42 },
    labelWidth: 120,
  });
}

export function createCatBottomRingPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const cx = document.width / 2;
  const cy = 130;
  const outerRadius = Math.min(document.width * 0.43, 520);
  const innerRadius = outerRadius * 0.76;
  const bounds = {
    x: cx - outerRadius,
    y: cy + innerRadius * 0.2,
    width: outerRadius * 2,
    height: outerRadius,
  };

  return createBaseShape("CAT Bottom", "ringSection", bounds, PRESET_COLORS.cat2, nextZIndex(document), {
    stylePreset: "cat2",
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle: -128,
    endAngle: 128,
    labelPosition: { x: cx, y: cy + outerRadius * 0.8 },
    labelWidth: 180,
  });
}

export function createLeftSideRingPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const cx = document.width / 2;
  const cy = 130;
  const outerRadius = Math.min(document.width * 0.47, 570);
  const innerRadius = outerRadius * 0.82;
  const bounds = {
    x: cx - outerRadius,
    y: cy - outerRadius * 0.15,
    width: outerRadius,
    height: outerRadius * 1.05,
  };

  return createBaseShape("CAT Left", "ringSection", bounds, PRESET_COLORS.cat3, nextZIndex(document), {
    stylePreset: "cat3",
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle: -132,
    endAngle: -84,
    labelPosition: { x: cx - outerRadius * 0.9, y: cy + outerRadius * 0.24 },
    labelWidth: 120,
  });
}

export function createRightSideRingPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const cx = document.width / 2;
  const cy = 130;
  const outerRadius = Math.min(document.width * 0.47, 570);
  const innerRadius = outerRadius * 0.82;
  const bounds = {
    x: cx,
    y: cy - outerRadius * 0.15,
    width: outerRadius,
    height: outerRadius * 1.05,
  };

  return createBaseShape("CAT Right", "ringSection", bounds, PRESET_COLORS.cat3, nextZIndex(document), {
    stylePreset: "cat3",
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle: 84,
    endAngle: 132,
    labelPosition: { x: cx + outerRadius * 0.9, y: cy + outerRadius * 0.24 },
    labelWidth: 120,
  });
}

export function createFanPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const cx = document.width / 2;
  const cy = 140;
  const outerRadius = Math.min(document.width * 0.28, 340);
  const bounds = {
    x: cx - outerRadius,
    y: cy,
    width: outerRadius * 2,
    height: outerRadius,
  };

  return createBaseShape("Fan Section", "fan", bounds, PRESET_COLORS.cat1, nextZIndex(document), {
    stylePreset: "cat1",
    cx,
    cy,
    innerRadius: 34,
    outerRadius,
    startAngle: -48,
    endAngle: 48,
    labelPosition: { x: cx, y: cy + outerRadius * 0.62 },
    labelWidth: 160,
  });
}

export function createRoundedBlockPreset(document: SeatMapEditorDocument): SeatMapEditorShape {
  const bounds = {
    x: 96 + (document.shapes.length % 4) * 42,
    y: 180 + (document.shapes.length % 3) * 38,
    width: Math.max(document.width * 0.2, 210),
    height: Math.max(document.height * 0.15, 120),
  };

  return createBaseShape("Rounded Block", "roundedRect", bounds, PRESET_COLORS.cat5, nextZIndex(document), {
    stylePreset: "cat5",
    cornerRadius: 34,
    labelPosition: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    labelWidth: bounds.width * 0.78,
  });
}

