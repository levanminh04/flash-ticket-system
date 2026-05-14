import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Circle,
  Diamond,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  Hexagon,
  Layers3,
  Lock,
  LockOpen,
  Move,
  MousePointer2,
  Pentagon,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Square,
  SquareStack,
  Trash2,
  Upload,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import OrganizerEventWorkspaceNav from "../../components/organizer/OrganizerEventWorkspaceNav";
import SeatMapEditorCanvas from "../../components/seat-map/editor/SeatMapEditorCanvas";
import {
  buildSeatMapPublishPayload,
  exportEditorDocument,
  importEditorDocument,
} from "../../components/seat-map/editor/seatMapEditorUtils";
import { useSeatMapEditorState } from "../../components/seat-map/editor/useSeatMapEditorState";
import {
  OrganizerEventDetail,
  OrganizerEventLayout,
  OrganizerSeatMap,
  organizerWorkspaceService,
} from "../../services/organizerWorkspaceService";
import { summarizeSeatMap } from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

function buildEditorSource(
  seatMap: OrganizerSeatMap | null,
  layout: OrganizerEventLayout | null,
): OrganizerSeatMap | null {
  if (seatMap) {
    return seatMap;
  }

  if (!layout) {
    return null;
  }

  return {
    layoutId: layout.id,
    backgroundImageUrl: layout.backgroundImageUrl,
    backgroundWidth: layout.backgroundWidth,
    backgroundHeight: layout.backgroundHeight,
    mapConfig: layout.mapConfig,
    sectors: [],
  };
}

type SeatLayoutFieldKey =
  | "rows"
  | "seatsPerRow"
  | "gapX"
  | "gapY"
  | "paddingX"
  | "paddingY"
  | "seatRadius"
  | "seatStartNumber";

const SEAT_LAYOUT_MINIMUMS: Record<SeatLayoutFieldKey, number> = {
  rows: 1,
  seatsPerRow: 1,
  gapX: 1,
  gapY: 1,
  paddingX: 0,
  paddingY: 0,
  seatRadius: 1,
  seatStartNumber: 1,
};

const DEFAULT_LAYOUT_INPUTS: Record<SeatLayoutFieldKey, string> = {
  rows: "",
  seatsPerRow: "",
  gapX: "",
  gapY: "",
  paddingX: "",
  paddingY: "",
  seatRadius: "",
  seatStartNumber: "",
};

function normalizeSeatLayoutValue(rawValue: string, minimum: number) {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return minimum;
  }

  return Math.max(minimum, parsedValue);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function OrganizerSeatMapPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { ready } = useOrganizerGate();
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(null);
  const [layout, setLayout] = useState<OrganizerEventLayout | null>(null);
  const [seatMap, setSeatMap] = useState<OrganizerSeatMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishElapsedSeconds, setPublishElapsedSeconds] = useState(0);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [seatLayoutInputs, setSeatLayoutInputs] = useState<Record<SeatLayoutFieldKey, string>>(DEFAULT_LAYOUT_INPUTS);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!ready || !eventId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextEvent, nextLayout, nextSeatMap] = await Promise.all([
          organizerWorkspaceService.getMyEvent(eventId),
          organizerWorkspaceService.getLayout(eventId),
          organizerWorkspaceService.getSeatMap(eventId),
        ]);

        if (!cancelled) {
          setEventDetail(nextEvent);
          setLayout(nextLayout);
          setSeatMap(nextSeatMap);
        }
      } catch {
        if (!cancelled) {
          toast.error("Khong the tai du lieu editor seat map cua su kien.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId, ready]);

  const editorSource = useMemo(() => buildEditorSource(seatMap, layout), [layout, seatMap]);
  const ticketTypes = eventDetail?.ticketTypes ?? [];
  const {
    activeTool,
    document,
    hasDraft,
    referenceImageVisible,
    selectedSeat,
    selectedSeatId,
    selectedShape,
    selectedShapeIds,
    viewport,
    addPolygon,
    addTrapezoid,
    addDiamond,
    addHexagon,
    addCircle,
    addEllipse,
    addRectangle,
    clearDraft,
    clearSeats,
    clearSelection,
    hideSeat,
    moveSeat,
    moveSeatBlock,
    moveShapeZIndex,
    regenerateSeats,
    removeShape,
    replaceDocument,
    resetViewport,
    resizeSeatBlock,
    resizeShape,
    restoreAllSeats,
    restoreSeat,
    selectSeat,
    selectShape,
    setActiveTool,
    setReferenceImageVisible,
    setViewport,
    toggleShapeLocked,
    toggleShapeVisibility,
    transformPolygon,
    translateShapeBy,
    updateSeatLayout,
    updateShape,
    updateSeat,
  } = useSeatMapEditorState(eventId, editorSource);

  useEffect(() => {
    // Triggers unsaved state whenever document config/shapes change, requiring user to explicitly "Lưu"
    setUnsavedChanges(true);
  }, [document]);

  useEffect(() => {
    if (!selectedShape) {
      setSeatLayoutInputs(DEFAULT_LAYOUT_INPUTS);
      return;
    }

    setSeatLayoutInputs({
      rows: String(selectedShape.seatLayout.rows),
      seatsPerRow: String(selectedShape.seatLayout.seatsPerRow),
      gapX: String(selectedShape.seatLayout.gapX),
      gapY: String(selectedShape.seatLayout.gapY),
      paddingX: String(selectedShape.seatLayout.paddingX),
      paddingY: String(selectedShape.seatLayout.paddingY),
      seatRadius: String(selectedShape.seatLayout.seatRadius),
      seatStartNumber: String(selectedShape.seatLayout.seatStartNumber),
    });
  }, [selectedShape]);

  useEffect(() => {
    if (!editingShapeId || !document?.shapes.some((shape) => shape.id === editingShapeId)) {
      setEditingShapeId(null);
    }
  }, [document, editingShapeId]);

  useEffect(() => {
    if (!publishing) {
      setPublishElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setPublishElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [publishing]);

  const handleSeatLayoutInputChange =
    (shapeId: string, key: SeatLayoutFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      setSeatLayoutInputs((current) => ({
        ...current,
        [key]: rawValue,
      }));

      if (rawValue.trim() === "") {
        return;
      }

      updateSeatLayout(shapeId, {
        [key]: normalizeSeatLayoutValue(rawValue, SEAT_LAYOUT_MINIMUMS[key]),
      });
    };

  const handleSeatLayoutInputBlur = (shapeId: string, key: SeatLayoutFieldKey) => {
    const normalizedValue = normalizeSeatLayoutValue(seatLayoutInputs[key], SEAT_LAYOUT_MINIMUMS[key]);
    setSeatLayoutInputs((current) => ({
      ...current,
      [key]: String(normalizedValue),
    }));
    updateSeatLayout(shapeId, { [key]: normalizedValue });
  };

  const seatDropdownOptions = useMemo(() => {
    if (!selectedShape) return { rows: [], seatNumbers: [] };
    const rowMap = new Map<string, boolean>();
    const noMap = new Map<string, boolean>();
    for (const seat of selectedShape.seats) {
      if (seat.rowName) {
        if (!rowMap.has(seat.rowName)) rowMap.set(seat.rowName, seat.hidden ?? false);
        else if (seat.hidden) rowMap.set(seat.rowName, true);
      }
      if (seat.seatNumber) {
        // Evaluate the hidden status of the seat number specific to the current row if selectedSeat exists
        if (selectedSeat && seat.rowName === selectedSeat.rowName) {
          noMap.set(seat.seatNumber, seat.hidden ?? false);
        } else if (!selectedSeat || !noMap.has(seat.seatNumber)) {
          if (!noMap.has(seat.seatNumber)) noMap.set(seat.seatNumber, seat.hidden ?? false);
          else if (seat.hidden) noMap.set(seat.seatNumber, true);
        }
      }
    }
    
    return {
      rows: Array.from(rowMap.entries())
        .map(([value, hidden]) => ({ value, hidden }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      seatNumbers: Array.from(noMap.entries())
        .map(([value, hidden]) => ({ value, hidden }))
        .sort((a, b) => parseInt(a.value) - parseInt(b.value)),
    };
  }, [selectedShape]);

  const handleShapeMetaChange = (
    shapeId: string,
    patch: { name?: string; color?: string; ticketTypeId?: string },
  ) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      ...(patch.name !== undefined ? { name: patch.name, label: patch.name } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.ticketTypeId !== undefined
        ? {
            ticketTypeId: patch.ticketTypeId || undefined,
            ticketTypeName: ticketTypes.find((ticketType) => ticketType.id === patch.ticketTypeId)?.name ?? undefined,
          }
        : {}),
    }));
  };

  const handlePublish = async () => {
    if (!eventId || !document) {
      return;
    }

    const expectedSummary = {
      sectorCount: document.shapes.filter((shape) => shape.visible !== false).length,
      activeSeatCount: document.shapes
        .filter((shape) => shape.visible !== false)
        .reduce(
          (total, shape) => total + shape.seats.filter((seat) => seat.hidden !== true).length,
          0,
        ),
    };

    const fetchPublishedSeatMap = async () => {
      const publishedSeatMap = await organizerWorkspaceService.getSeatMap(eventId);
      if (!publishedSeatMap) {
        return null;
      }

      const publishedSummary = summarizeSeatMap(publishedSeatMap);
      const looksUpdated =
        publishedSummary.sectorCount === expectedSummary.sectorCount &&
        publishedSummary.activeSeatCount === expectedSummary.activeSeatCount;

      return looksUpdated ? publishedSeatMap : null;
    };

    setPublishing(true);
    try {
      const payload = buildSeatMapPublishPayload(document, {
        name: layout?.name ?? "Seat map",
        backgroundPublicId: layout?.backgroundPublicId,
        mapConfig: layout?.mapConfig,
      });
      await organizerWorkspaceService.publishSeatMap(eventId, payload);
      let publishedSeatMap = await fetchPublishedSeatMap();

      if (!publishedSeatMap) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await wait(2000);
          publishedSeatMap = await fetchPublishedSeatMap();
          if (publishedSeatMap) {
            break;
          }
        }
      }

      if (!publishedSeatMap) {
        throw new Error("publish_pending");
      }

      setSeatMap(publishedSeatMap);
      toast.success("Da publish seat map.");
    } catch {
      toast.info("Backend van dang publish. Dang doi dong bo seat map...");

      try {
        let publishedSeatMap = null;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await wait(2000);
          publishedSeatMap = await fetchPublishedSeatMap();
          if (publishedSeatMap) {
            break;
          }
        }

        if (publishedSeatMap) {
          setSeatMap(publishedSeatMap);
          toast.success("Da publish seat map.");
        } else {
          toast.error("Khong the xac nhan publish seat map. Hay kiem tra lai sau.");
        }
      } catch {
        toast.error("Khong the xac nhan publish seat map. Hay kiem tra lai sau.");
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleExportJson = () => {
    if (!document || !eventId) {
      return;
    }

    const blob = new Blob([exportEditorDocument(document)], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `seat-map-${eventId}.json`;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  };

  const handleImportJsonClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const rawValue = await file.text();
      const importedDocument = importEditorDocument(rawValue);
      if (!importedDocument) {
        toast.error("File JSON khong dung dinh dang seat map editor.");
        return;
      }

      replaceDocument(importedDocument);
      setUnsavedChanges(true);
      toast.success("Da import seat map JSON vao editor.");
    } catch {
      toast.error("Khong the doc file JSON.");
    }
  };

  return (
    <OrganizerLayout
      title="Seat map"
      description="Canvas editor de organizer ve shape va sinh seat overlay tren reference image. Generate, click, drag va an seat theo tung shape."
    >
      {eventId ? <OrganizerEventWorkspaceNav eventId={eventId} /> : null}

      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Dang tai editor seat map</p>
        </section>
      ) : !document ? (
        <section className="organizer-panel organizer-empty-state">
          <p>
            Event nay chua co layout hoac seat map kha dung. Hay tao layout va gan anh reference
            truoc khi dung shape va seat overlay.
          </p>
        </section>
      ) : (
        <>
          <section className="organizer-seat-map-editor-layout">
            <div className="organizer-seat-map-left-col">
              <section className="organizer-panel organizer-seat-map-editor-panel">
                <div className="organizer-panel-heading organizer-seat-map-editor-heading">
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <p className="organizer-panel-title-pill">Shape and seat canvas (Zoom: {Math.round(viewport.scale * 100)}%)</p>
                  </div>
                </div>

                <div className="organizer-seat-map-stage-frame">
                  <SeatMapEditorCanvas
                    document={document}
                    viewport={viewport}
                    referenceImageVisible={referenceImageVisible}
                    selectedShapeIds={selectedShapeIds}
                    selectedSeatId={selectedSeatId}
                    onClearSelection={clearSelection}
                    onMoveSeat={moveSeat}
                    onMoveSeatBlock={moveSeatBlock}
                    onResizeSeatBlock={resizeSeatBlock}
                    onResizeShape={resizeShape}
                    onSelectSeat={selectSeat}
                    onSelectShape={selectShape}
                    onTransformPolygon={transformPolygon}
                    onTranslateShape={translateShapeBy}
                    onViewportChange={setViewport}
                  />
                </div>
              </section>

              <section className="organizer-seat-map-detail-panel">
                <div className="organizer-seat-map-detail-grid">
                  <section className="organizer-seat-map-detail-card organizer-seat-map-detail-card-wide">
                    <div className="organizer-seat-map-sidebar-section-header">
                      <SquareStack size={18} />
                      <strong>Selected shape</strong>
                    </div>

                    {selectedShape ? (
                      <>
                        <div className="organizer-seat-map-detail-info">
                          <h3>{selectedShape.name}</h3>
                          <div className="organizer-seat-map-detail-meta-row">
                            <span>{selectedShape.shapeType}</span>
                            <span>
                              {Math.round(selectedShape.bounds.width)} × {Math.round(selectedShape.bounds.height)}
                            </span>
                            <span>{selectedShape.visible ? "Visible" : "Hidden"}</span>
                            <span>{selectedShape.locked ? "Locked" : "Unlocked"}</span>
                            <span>{selectedShape.seatCount} seats</span>
                            <span>{selectedShape.seats.filter((s) => s.hidden).length} hidden</span>
                            <span>{selectedShape.ticketTypeName ?? "No ticket type"}</span>
                          </div>
                        </div>

                        <div className="organizer-seat-map-detail-actions">
                          <button
                            type="button"
                            className="btn organizer-inline-button organizer-seat-map-zoom-button"
                            onClick={() => toggleShapeVisibility(selectedShape.id)}
                          >
                            {selectedShape.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                            {selectedShape.visible ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            className="btn organizer-inline-button organizer-seat-map-zoom-button"
                            onClick={() => toggleShapeLocked(selectedShape.id)}
                          >
                            {selectedShape.locked ? <LockOpen size={16} /> : <Lock size={16} />}
                            {selectedShape.locked ? "Unlock" : "Lock"}
                          </button>
                          <button
                            type="button"
                            className="btn organizer-inline-button organizer-seat-map-zoom-button"
                            onClick={() => moveShapeZIndex(selectedShape.id, "down")}
                          >
                            <ArrowDownToLine size={16} />
                            Back
                          </button>
                          <button
                            type="button"
                            className="btn organizer-inline-button organizer-seat-map-zoom-button"
                            onClick={() => moveShapeZIndex(selectedShape.id, "up")}
                          >
                            <ArrowUpToLine size={16} />
                            Front
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="organizer-seat-map-detail-empty">
                        Chon mot shape tren canvas hoac sidebar de bat dau sinh seat overlay.
                      </p>
                    )}
                  </section>

                  {selectedShape ? (
                    <section className="organizer-seat-map-detail-card organizer-seat-map-detail-card-wide">
                      <div className="organizer-seat-map-sidebar-section-header">
                        <Layers3 size={18} />
                        <strong>Seat generation</strong>
                      </div>

                      <div className="organizer-seat-map-detail-form-row">
                        {(["rows", "seatsPerRow", "gapX", "gapY", "paddingX", "paddingY", "seatRadius", "seatStartNumber"] as SeatLayoutFieldKey[]).map(
                          (key) => (
                            <label key={key} className="organizer-seat-map-form-field">
                              <span>{key}</span>
                              <input
                                type="number"
                                min={SEAT_LAYOUT_MINIMUMS[key]}
                                value={seatLayoutInputs[key]}
                                onChange={handleSeatLayoutInputChange(selectedShape.id, key)}
                                onBlur={() => handleSeatLayoutInputBlur(selectedShape.id, key)}
                              />
                            </label>
                          ),
                        )}
                      </div>

                      <div className="organizer-seat-map-detail-actions">
                        <button
                          type="button"
                          className="btn organizer-inline-button organizer-seat-map-zoom-button"
                          onClick={() => regenerateSeats(selectedShape.id)}
                        >
                          <Plus size={16} />
                          Generate seats
                        </button>
                        <button
                          type="button"
                          className="btn organizer-inline-button organizer-seat-map-zoom-button"
                          onClick={() => restoreAllSeats(selectedShape.id)}
                        >
                          <RotateCcw size={16} />
                          Restore hidden
                        </button>
                        <button
                          type="button"
                          className="btn organizer-inline-button organizer-seat-map-danger-button"
                          onClick={() => clearSeats(selectedShape.id)}
                        >
                          <Trash2 size={16} />
                          Clear seats
                        </button>
                      </div>
                    </section>
                  ) : null}

                </div>
              </section>
            </div>

            <aside className="organizer-panel organizer-seat-map-sidebar">
              <div className="organizer-panel-heading">
                <p className="organizer-panel-title-pill">Control panel</p>
              </div>

              <section className="organizer-seat-map-sidebar-section">
                <div className="organizer-seat-map-sidebar-section-header">
                  <MousePointer2 size={18} />
                  <strong>Workspace tools</strong>
                </div>

                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={handleImportJson}
                />

                <div className="organizer-seat-map-canvas-actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className={`btn organizer-inline-button organizer-seat-map-toolbar-button ${activeTool === "rectangle" ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveTool("rectangle");
                      addRectangle();
                    }}
                  >
                    <Square size={16} />
                    Rectangle
                  </button>

                  <button
                    type="button"
                    className={`btn organizer-inline-button organizer-seat-map-toolbar-button ${activeTool === "polygon" ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveTool("polygon");
                      addPolygon();
                    }}
                  >
                    <Pentagon size={16} />
                    Polygon
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => {
                      setActiveTool("polygon");
                      addTrapezoid();
                    }}
                  >
                    <Pentagon size={16} />
                    Trapezoid
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => {
                      setActiveTool("polygon");
                      addDiamond();
                    }}
                  >
                    <Diamond size={16} />
                    Diamond
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => {
                      setActiveTool("polygon");
                      addHexagon();
                    }}
                  >
                    <Hexagon size={16} />
                    Hexagon
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => {
                      setActiveTool("rectangle");
                      addCircle();
                    }}
                  >
                    <Circle size={16} />
                    Circle
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => {
                      setActiveTool("rectangle");
                      addEllipse();
                    }}
                  >
                    <Ellipsis size={16} />
                    Ellipse
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => setReferenceImageVisible((current) => !current)}
                  >
                    {referenceImageVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {referenceImageVisible ? "Hide reference" : "Show reference"}
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={resetViewport}
                  >
                    <Move size={16} />
                    Reset view
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={handleImportJsonClick}
                  >
                    <Upload size={16} />
                    Import JSON
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={handleExportJson}
                    disabled={!document}
                  >
                    <Download size={16} />
                    Export JSON
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={clearDraft}
                    disabled={!hasDraft}
                  >
                    <Trash2 size={16} />
                    Xoa draft local
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={() => {
                      toast.success("Đã ghi nhận toàn bộ chỉnh sửa cục bộ.");
                      setUnsavedChanges(false);
                    }}
                    disabled={!unsavedChanges}
                  >
                    <Save size={16} />
                    Lưu
                  </button>

                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-toolbar-button"
                    onClick={handlePublish}
                    disabled={publishing || unsavedChanges}
                  >
                    <Plus size={16} />
                    {publishing
                      ? `Publishing... ${formatElapsedTime(publishElapsedSeconds)}`
                      : "Publish"}
                  </button>
                </div>
              </section>

              <section className="organizer-seat-map-sidebar-section">
                <div className="organizer-seat-map-sidebar-section-header">
                  <Layers3 size={18} />
                  <strong>Shape layers</strong>
                </div>

                {!document.shapes.length ? (
                  <div className="organizer-empty-state compact organizer-seat-map-empty-layers">
                    <p>Chua co shape nao. Hay them rectangle, polygon hoac cac preset khac de bat dau dung sector.</p>
                  </div>
                ) : (
                  <div className="organizer-seat-map-layer-list">
                    {document.shapes.map((shape) => {
                      const isActive = selectedShapeIds.includes(shape.id);

                      return (
                        <div
                          key={shape.id}
                          className={`organizer-seat-map-layer-item ${isActive ? "is-active" : ""}`}
                        >
                          <button
                            type="button"
                            className="organizer-seat-map-layer-main"
                            onClick={(event) =>
                              selectShape(shape.id, event.ctrlKey || event.metaKey || event.shiftKey)
                            }
                          >
                            <span
                              className="organizer-seat-map-layer-swatch"
                              style={{ backgroundColor: shape.color, opacity: shape.visible ? 1 : 0.3 }}
                            />

                            <span className="organizer-seat-map-layer-copy">
                              <strong>{shape.name}</strong>
                              <span>
                                {shape.shapeType} · {shape.seatCount} seats · z{shape.zIndex}
                              </span>
                            </span>
                          </button>

                          <div className="organizer-seat-map-layer-actions">
                            <button
                              type="button"
                              className="organizer-seat-map-layer-edit"
                              aria-label={`Edit sector ${shape.name}`}
                              title="Edit sector"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectShape(shape.id, false);
                                setEditingShapeId((current) => (current === shape.id ? null : shape.id));
                              }}
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              type="button"
                              className="organizer-seat-map-layer-delete"
                              aria-label={`Delete sector ${shape.name}`}
                              title="Delete sector"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (editingShapeId === shape.id) {
                                  setEditingShapeId(null);
                                }
                                removeShape(shape.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {editingShapeId === shape.id ? (
                            <div className="organizer-seat-map-layer-editor">
                              <label className="organizer-seat-map-form-field">
                                <span>Sector name</span>
                                <input
                                  type="text"
                                  value={shape.name}
                                  onChange={(event) =>
                                    handleShapeMetaChange(shape.id, { name: event.target.value })
                                  }
                                />
                              </label>

                              <label className="organizer-seat-map-form-field">
                                <span>Sector color</span>
                                <input
                                  type="color"
                                  value={shape.color}
                                  onChange={(event) =>
                                    handleShapeMetaChange(shape.id, { color: event.target.value })
                                  }
                                />
                              </label>

                              <label className="organizer-seat-map-form-field">
                                <span>Ticket type</span>
                                <select
                                  value={shape.ticketTypeId ?? ""}
                                  onChange={(event) =>
                                    handleShapeMetaChange(shape.id, {
                                      ticketTypeId: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">Select Ticket</option>
                                  {ticketTypes.map((ticketType) => (
                                    <option key={ticketType.id} value={ticketType.id}>
                                      {ticketType.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="organizer-seat-map-sidebar-section">
                <div className="organizer-seat-map-sidebar-section-header">
                  <MousePointer2 size={18} />
                  <strong>Selected seat</strong>
                </div>

                <div className="organizer-seat-map-detail-info" style={{ marginBottom: "1rem" }}>
                  <div className="organizer-seat-map-detail-meta-row">
                    <span>Sector: {selectedShape?.name || "-"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "1rem" }}>
                  <label className="organizer-seat-map-form-field">
                    <span>Row</span>
                    <select
                      value={selectedSeat?.rowName || ""}
                      onChange={(e) => selectedShape && selectedSeat && updateSeat(selectedShape.id, selectedSeat.id, { rowName: e.target.value })}
                    >
                      <option value="" disabled>--Select Row--</option>
                      {seatDropdownOptions.rows.map((row) => (
                        <option key={row.value} value={row.value}>
                          {row.value}{row.hidden ? " - hide" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="organizer-seat-map-form-field">
                    <span>Seat No</span>
                    <select
                      value={selectedSeat?.seatNumber || ""}
                      onChange={(e) => selectedShape && selectedSeat && updateSeat(selectedShape.id, selectedSeat.id, { seatNumber: e.target.value })}
                    >
                      <option value="" disabled>--Select No--</option>
                      {seatDropdownOptions.seatNumbers.map((no) => (
                        <option key={no.value} value={no.value}>
                          {no.value}{no.hidden ? " - hide" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="organizer-seat-map-form-field">
                    <span>Seat type</span>
                    <select
                      value={selectedSeat?.seatType || "Standard"}
                      onChange={(e) => selectedShape && selectedSeat && updateSeat(selectedShape.id, selectedSeat.id, { seatType: e.target.value })}
                    >
                      <option value="Standard">Standard</option>
                      <option value="VIP">VIP</option>
                      <option value="Accessible">Accessible</option>
                      <option value="Companion">Companion</option>
                    </select>
                  </label>
                </div>

                <div className="organizer-seat-map-canvas-actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-danger-button"
                    onClick={() => selectedShape && selectedSeat && hideSeat(selectedShape.id, selectedSeat.id)}
                    disabled={!selectedShape || !selectedSeat}
                  >
                    <EyeOff size={16} />
                    Hide seat
                  </button>
                  <button
                    type="button"
                    className="btn organizer-inline-button organizer-seat-map-zoom-button"
                    onClick={() => selectedShape && selectedSeat && restoreSeat(selectedShape.id, selectedSeat.id)}
                    disabled={!selectedShape || !selectedSeat}
                  >
                    <Eye size={16} />
                    Show seat
                  </button>
                </div>
              </section>
            </aside>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}
