export interface SectorStylePreset {
  fill: string;
  stroke: string;
  strokeWidth: number;
  labelColor: string;
  labelFontSize: number;
  labelFontWeight: "normal" | "bold";
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export type SectorStylePresetName =
  | "vip"
  | "cat1"
  | "cat2"
  | "cat3"
  | "cat4"
  | "cat5"
  | "stage"
  | "foh"
  | "default";

export const sectorStylePresets: Record<SectorStylePresetName, SectorStylePreset> = {
  vip: {
    fill: "rgba(250, 204, 21, 0.3)",
    stroke: "#f59e0b",
    strokeWidth: 2,
    labelColor: "#fff7ed",
    labelFontSize: 16,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 8,
    shadowOpacity: 0.28,
    shadowOffsetX: 0,
    shadowOffsetY: 5,
  },
  cat1: {
    fill: "rgba(34, 197, 94, 0.28)",
    stroke: "#22c55e",
    strokeWidth: 2,
    labelColor: "#ecfdf5",
    labelFontSize: 15,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 7,
    shadowOpacity: 0.24,
    shadowOffsetX: 0,
    shadowOffsetY: 5,
  },
  cat2: {
    fill: "rgba(59, 130, 246, 0.28)",
    stroke: "#60a5fa",
    strokeWidth: 2,
    labelColor: "#eff6ff",
    labelFontSize: 15,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 7,
    shadowOpacity: 0.24,
    shadowOffsetX: 0,
    shadowOffsetY: 5,
  },
  cat3: {
    fill: "rgba(168, 85, 247, 0.28)",
    stroke: "#a78bfa",
    strokeWidth: 2,
    labelColor: "#faf5ff",
    labelFontSize: 15,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 7,
    shadowOpacity: 0.24,
    shadowOffsetX: 0,
    shadowOffsetY: 5,
  },
  cat4: {
    fill: "rgba(249, 115, 22, 0.28)",
    stroke: "#fb923c",
    strokeWidth: 2,
    labelColor: "#fff7ed",
    labelFontSize: 14,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 7,
    shadowOpacity: 0.22,
    shadowOffsetX: 0,
    shadowOffsetY: 5,
  },
  cat5: {
    fill: "rgba(20, 184, 166, 0.28)",
    stroke: "#2dd4bf",
    strokeWidth: 2,
    labelColor: "#ecfeff",
    labelFontSize: 14,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 7,
    shadowOpacity: 0.22,
    shadowOffsetX: 0,
    shadowOffsetY: 5,
  },
  stage: {
    fill: "rgba(30, 41, 59, 0.96)",
    stroke: "#94a3b8",
    strokeWidth: 2,
    labelColor: "#f8fafc",
    labelFontSize: 24,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 10,
    shadowOpacity: 0.3,
    shadowOffsetX: 0,
    shadowOffsetY: 6,
  },
  foh: {
    fill: "rgba(100, 116, 139, 0.68)",
    stroke: "#cbd5e1",
    strokeWidth: 2,
    labelColor: "#f8fafc",
    labelFontSize: 13,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 6,
    shadowOpacity: 0.24,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
  },
  default: {
    fill: "rgba(22, 163, 74, 0.22)",
    stroke: "#16a34a",
    strokeWidth: 2,
    labelColor: "#f8fafc",
    labelFontSize: 13,
    labelFontWeight: "bold",
    shadowColor: "#000000",
    shadowBlur: 6,
    shadowOpacity: 0.2,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
  },
};

export function resolveSectorStylePreset(value: unknown): SectorStylePreset {
  return typeof value === "string" && value in sectorStylePresets
    ? sectorStylePresets[value as SectorStylePresetName]
    : sectorStylePresets.default;
}
