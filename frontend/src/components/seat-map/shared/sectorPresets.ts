import {
  SeatMapEditorBounds,
  SeatMapEditorDocument,
  SeatMapEditorShape,
} from "../editor/seatMapEditorTypes";

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
    id: crypto.randomUUID(),
    sectorId: crypto.randomUUID(),
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

function nextZIndex(document: SeatMapEditorDocument) {
  return document.shapes.length;
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
