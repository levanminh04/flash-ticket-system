import {
  Eye,
  EyeOff,
  MousePointer2,
  Redo2,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import SeatMapEditorCanvas from "./SeatMapEditorCanvas";
import { SeatMapEditorDocument, SeatMapEditorViewport } from "./seatMapEditorTypes";

interface SeatMapCanvasShellProps {
  document: SeatMapEditorDocument;
  viewport: SeatMapEditorViewport;
  referenceImageVisible: boolean;
  activeTool: string;
  selectedShapeIds: string[];
  selectedSeatId: string | null;
  selectedSeatIds: string[];
  canRedo: boolean;
  canUndo: boolean;
  onClearSeatSelection: () => void;
  onMoveSeat: (shapeId: string, seatId: string, nextX: number, nextY: number) => void;
  onMoveSeatBlock: (shapeId: string, deltaX: number, deltaY: number) => void;
  onResizeSeatBlock: (
    shapeId: string,
    previousBounds: { x: number; y: number; width: number; height: number },
    nextBounds: { x: number; y: number; width: number; height: number },
  ) => void;
  onResizeShape: (shapeId: string, nextBounds: { x: number; y: number; width: number; height: number }) => void;
  onSelectSeat: (shapeId: string, seatId: string | null, additive?: boolean) => void;
  onSelectShape: (shapeId: string | null, additive?: boolean) => void;
  onSelectShapes: (shapeIds: string[]) => void;
  onTransformPolygon: (
    shapeId: string,
    nextBounds: { x: number; y: number; width: number; height: number },
    scaleX: number,
    scaleY: number,
  ) => void;
  onTranslateShape: (shapeId: string, deltaX: number, deltaY: number) => void;
  onTranslateShapes: (shapeIds: string[], deltaX: number, deltaY: number) => void;
  onViewportChange: (viewport: SeatMapEditorViewport) => void;
  onDeleteSelected: () => void;
  onRedo: () => void;
  onSetActiveTool: (tool: "select" | "polygon" | "rectangle") => void;
  onToggleReference: () => void;
  onUndo: () => void;
}

export default function SeatMapCanvasShell({
  document,
  viewport,
  referenceImageVisible,
  activeTool,
  selectedShapeIds,
  selectedSeatId,
  selectedSeatIds,
  canRedo,
  canUndo,
  onClearSeatSelection,
  onMoveSeat,
  onMoveSeatBlock,
  onResizeSeatBlock,
  onResizeShape,
  onSelectSeat,
  onSelectShape,
  onSelectShapes,
  onTransformPolygon,
  onTranslateShape,
  onTranslateShapes,
  onViewportChange,
  onDeleteSelected,
  onRedo,
  onSetActiveTool,
  onToggleReference,
  onUndo,
}: SeatMapCanvasShellProps) {
  const [resetViewKey, setResetViewKey] = useState(0);
  const handleZoomIn = () => {
    onViewportChange({
      ...viewport,
      scale: Math.min(4, viewport.scale * 1.15),
    });
  };
  const handleResetView = () => {
    setResetViewKey((current) => current + 1);
  };

  return (
    <section className="seat-map-canvas-workspace">
      <div className="seat-map-canvas-card">
        <div className="seat-map-canvas-grid" />
        <div className="seat-map-floating-toolbar">
          <button
            type="button"
            className={activeTool === "select" ? "is-active" : ""}
            onClick={() => onSetActiveTool("select")}
          >
            <MousePointer2 size={15} />
            Select
          </button>
          <button
            type="button"
            className={referenceImageVisible ? "is-active" : ""}
            onClick={onToggleReference}
          >
            {referenceImageVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            {referenceImageVisible ? "Hide" : "Show"}
          </button>
          <button type="button" onClick={handleZoomIn}>
            <Search size={15} />
            Zoom
          </button>
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            <Undo2 size={15} />
            Undo
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            <Redo2 size={15} />
            Redo
          </button>
          <button type="button" onClick={handleResetView}>
            <RotateCcw size={15} />
            Reset
          </button>
          <button type="button" className="danger" onClick={onDeleteSelected} disabled={!selectedShapeIds.length}>
            <Trash2 size={15} />
            Delete
          </button>
        </div>

        <SeatMapEditorCanvas
          document={document}
          viewport={viewport}
          referenceImageVisible={referenceImageVisible}
          selectedShapeIds={selectedShapeIds}
          selectedSeatId={selectedSeatId}
          selectedSeatIds={selectedSeatIds}
          onClearSeatSelection={onClearSeatSelection}
          onMoveSeat={onMoveSeat}
          onMoveSeatBlock={onMoveSeatBlock}
          onResizeSeatBlock={onResizeSeatBlock}
          onResizeShape={onResizeShape}
          onSelectSeat={onSelectSeat}
          onSelectShape={onSelectShape}
          onSelectShapes={onSelectShapes}
          onTransformPolygon={onTransformPolygon}
          onTranslateShape={onTranslateShape}
          onTranslateShapes={onTranslateShapes}
          onViewportChange={onViewportChange}
          resetViewKey={resetViewKey}
        />
      </div>
    </section>
  );
}
