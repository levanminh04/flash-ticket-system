import { memo } from "react";
import { Group, Line, Path, Rect } from "react-konva";
import { MdOutlineEventSeat } from "react-icons/md";

interface SeatRendererProps {
  id: string;
  x: number;
  y: number;
  radius: number;
  status?: string;
  selected?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  color?: string;
  editable?: boolean;
  draggable?: boolean;
  onClick?: (event: any) => void;
  onTap?: (event: any) => void;
  onDragStart?: (event: any) => void;
  onDragEnd?: (event: any) => void;
  onMouseEnter?: (event: any) => void;
  onMouseLeave?: (event: any) => void;
  memoizeEventHandlers?: boolean;
}

const EVENT_SEAT_ICON_PATH =
  "M15 5v7H9V5h6m0-2H9c-1.1 0-2 .9-2 2v9h10V5c0-1.1-.9-2-2-2zm7 7h-3v3h3v-3zM5 10H2v3h3v-3zm15 5H4v6h2v-4h12v4h2v-6z";
const EVENT_SEAT_ICON_VIEWBOX = MdOutlineEventSeat.name ? 24 : 24;

function getSeatFill(status?: string, selected = false, hidden = false, color = "#16a34a") {
  if (selected) {
    return color;
  }
  if (hidden) {
    return "rgba(148, 163, 184, 0.22)";
  }

  switch (status) {
    case "SOLD":
      return "#cbd5e1";
    case "RESERVED":
      return "#fef3c7";
    case "LOCKED":
      return "#dbeafe";
    case "BLOCKED":
      return "#94a3b8";
    default:
      return color;
  }
}

function getSeatStroke(status?: string, selected = false, color = "#16a34a") {
  if (selected) {
    return "#ffffff";
  }

  switch (status) {
    case "SOLD":
      return "#94a3b8";
    case "RESERVED":
      return "#f59e0b";
    case "LOCKED":
      return "#60a5fa";
    case "BLOCKED":
      return "#64748b";
    default:
      return color;
  }
}

function SeatRendererBase({
  id,
  x,
  y,
  radius,
  status,
  selected = false,
  hidden = false,
  disabled = false,
  color,
  editable = true,
  draggable = false,
  onClick,
  onTap,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  memoizeEventHandlers: _memoizeEventHandlers,
}: SeatRendererProps) {
  const iconSize = Math.max(radius * 2.8, 16);
  const iconScale = iconSize / EVENT_SEAT_ICON_VIEWBOX;
  const iconOffset = iconSize / 2;
  const seatColor = color || "#16a34a";
  const fill = getSeatFill(status, selected, hidden, seatColor);
  const stroke = getSeatStroke(status, selected, seatColor);

  return (
    <Group
      key={id}
      name="seat-node"
      x={x}
      y={y}
      opacity={hidden || disabled ? 0.58 : 1}
      listening={editable}
      draggable={draggable && !hidden}
      onClick={onClick}
      onTap={onTap}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Rect
        name="seat-node"
        x={-iconOffset}
        y={-iconOffset}
        width={iconSize}
        height={iconSize}
        fill={selected ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0)"}
        cornerRadius={Math.max(4, radius * 0.45)}
        listening
        perfectDrawEnabled={false}
      />

      <Path
        name="seat-node"
        data={EVENT_SEAT_ICON_PATH}
        x={-iconOffset}
        y={-iconOffset}
        scaleX={iconScale}
        scaleY={iconScale}
        fill={disabled && !selected ? "#94a3b8" : fill}
        stroke={stroke}
        strokeWidth={selected ? 1.35 : 0.75}
        shadowColor={seatColor}
        shadowBlur={selected ? 10 : 0}
        shadowOpacity={selected ? 0.55 : 0}
        shadowOffset={{ x: 0, y: selected ? 2 : 0 }}
        listening
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      {selected ? (
        <Line
          x={0}
          y={0}
          points={[-radius * 0.35, 0, -radius * 0.1, radius * 0.3, radius * 0.52, -radius * 0.36]}
          stroke="#ffffff"
          strokeWidth={Math.max(1.5, radius * 0.28)}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      ) : null}

    </Group>
  );
}

export const SeatRenderer = memo(SeatRendererBase, (previous, next) =>
  previous.id === next.id &&
  previous.x === next.x &&
  previous.y === next.y &&
  previous.radius === next.radius &&
  previous.status === next.status &&
  previous.selected === next.selected &&
  previous.hidden === next.hidden &&
  previous.disabled === next.disabled &&
  previous.color === next.color &&
  previous.editable === next.editable &&
  previous.draggable === next.draggable &&
  previous.memoizeEventHandlers === next.memoizeEventHandlers &&
  (previous.memoizeEventHandlers ||
    (previous.onClick === next.onClick &&
      previous.onTap === next.onTap &&
      previous.onDragStart === next.onDragStart &&
      previous.onDragEnd === next.onDragEnd &&
      previous.onMouseEnter === next.onMouseEnter &&
      previous.onMouseLeave === next.onMouseLeave)),
);
