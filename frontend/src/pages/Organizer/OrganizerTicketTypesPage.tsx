import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Edit, Search, Trash2, X } from "lucide-react";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import OrganizerEventWorkspaceNav from "../../components/organizer/OrganizerEventWorkspaceNav";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerSeatMap,
  OrganizerTicketType,
  OrganizerTicketTypePayload,
} from "../../services/organizerWorkspaceService";
import {
  formatDateTime,
  formatMoney,
  getTicketTypeStatusMeta,
  toDateTimeLocal,
  toIsoString,
} from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

type TicketTypeFormState = {
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  quantityTotal: string;
  maxPerOrder: string;
  saleStartDatetime: string;
  saleEndDatetime: string;
  seatSelectionEnabled: boolean;
  colorCode: string;
  displayOrder: string;
  eventSectorId: string;
  isVisible: boolean;
};

const defaultFormState: TicketTypeFormState = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  quantityTotal: "",
  maxPerOrder: "10",
  saleStartDatetime: "",
  saleEndDatetime: "",
  seatSelectionEnabled: false,
  colorCode: "#16a34a",
  displayOrder: "0",
  eventSectorId: "",
  isVisible: true,
};

function buildFormState(ticketType: OrganizerTicketType): TicketTypeFormState {
  return {
    name: ticketType.name || "",
    description: ticketType.description || "",
    price: String(ticketType.price ?? ""),
    originalPrice: String(ticketType.originalPrice ?? ""),
    quantityTotal: String(ticketType.quantityTotal ?? ""),
    maxPerOrder: String(ticketType.maxPerOrder ?? 10),
    saleStartDatetime: toDateTimeLocal(ticketType.saleStartDatetime),
    saleEndDatetime: toDateTimeLocal(ticketType.saleEndDatetime),
    seatSelectionEnabled: Boolean(ticketType.seatSelectionEnabled),
    colorCode: ticketType.colorCode || "#16a34a",
    displayOrder: String(ticketType.displayOrder ?? 0),
    eventSectorId: ticketType.eventSectorId || "",
    isVisible: Boolean(ticketType.isVisible),
  };
}

function toPayload(
  formState: TicketTypeFormState,
  quantityTotalOverride?: number,
  forceSeatSelectionEnabled?: boolean,
  useSeatMap?: boolean,
): OrganizerTicketTypePayload | null {
  const price = Number(formState.price);
  const quantityTotal = quantityTotalOverride ?? Number(formState.quantityTotal);

  if (
    !formState.name.trim() ||
    Number.isNaN(price) ||
    Number.isNaN(quantityTotal)
  ) {
    return null;
  }

  return {
    name: formState.name.trim(),
    description: formState.description.trim() || undefined,
    price,
    originalPrice: formState.originalPrice
      ? Number(formState.originalPrice)
      : undefined,
    quantityTotal,
    maxPerOrder: formState.maxPerOrder
      ? Number(formState.maxPerOrder)
      : undefined,
    saleStartDatetime: toIsoString(formState.saleStartDatetime),
    saleEndDatetime: toIsoString(formState.saleEndDatetime),
    seatSelectionEnabled: forceSeatSelectionEnabled ?? formState.seatSelectionEnabled,
    colorCode: formState.colorCode || undefined,
    displayOrder: formState.displayOrder
      ? Number(formState.displayOrder)
      : undefined,
    eventSectorId: useSeatMap ? formState.eventSectorId.trim() || undefined : undefined,
    isVisible: formState.isVisible,
  };
}

export default function OrganizerTicketTypesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const { ready } = useOrganizerGate();
  const [ticketTypes, setTicketTypes] = useState<OrganizerTicketType[]>([]);
  const [seatMap, setSeatMap] = useState<OrganizerSeatMap | null>(null);
  const [setupMode, setSetupMode] = useState<"QUANTITY" | "SEAT_MAP" | null>(null);
  const [formState, setFormState] =
    useState<TicketTypeFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [ticketSearch, setTicketSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const setupStorageKey = eventId
    ? `organizer-ticket-setup-mode:${eventId}`
    : "";
  const requestedSetupMode = searchParams.get("mode");
  const requestedSectorId = searchParams.get("sectorId");
  const shouldOpenCreateForm = searchParams.get("create") === "1";

  useEffect(() => {
    if (!ready || !eventId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextTicketTypes, nextSeatMap] = await Promise.all([
          organizerWorkspaceService.getTicketTypes(eventId),
          organizerWorkspaceService.getSeatMap(eventId),
        ]);

        if (cancelled) {
          return;
        }

        setTicketTypes(nextTicketTypes);
        setSeatMap(nextSeatMap);

        if (requestedSetupMode === "SEAT_MAP") {
          setSetupMode("SEAT_MAP");
          if (setupStorageKey) {
            sessionStorage.setItem(setupStorageKey, "SEAT_MAP");
          }
          if (shouldOpenCreateForm) {
            setEditingId(null);
            setFormState({
              ...defaultFormState,
              eventSectorId: requestedSectorId || "",
            });
            setIsCreateFormOpen(true);
          }
          return;
        }

        const storedSetupMode = setupStorageKey
          ? sessionStorage.getItem(setupStorageKey)
          : null;
        setSetupMode(
          storedSetupMode === "QUANTITY" || storedSetupMode === "SEAT_MAP"
            ? storedSetupMode
            : null,
        );
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải danh sách loại vé.");
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
  }, [
    eventId,
    ready,
    requestedSectorId,
    requestedSetupMode,
    setupStorageKey,
    shouldOpenCreateForm,
  ]);

  const handleChange = <K extends keyof TicketTypeFormState>(
    key: K,
    value: TicketTypeFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingId(null);
    setIsCreateFormOpen(false);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setFormState(defaultFormState);
    setIsCreateFormOpen(true);
  };

  const handleChooseQuantityMode = () => {
    setSetupMode("QUANTITY");
    if (setupStorageKey) {
      sessionStorage.setItem(setupStorageKey, "QUANTITY");
    }
    setEditingId(null);
    setFormState(defaultFormState);
    setIsCreateFormOpen(true);
  };

  const handleChooseSeatMapMode = () => {
    setSetupMode("SEAT_MAP");
    if (setupStorageKey) {
      sessionStorage.setItem(setupStorageKey, "SEAT_MAP");
    }
    resetForm();
  };

  const activeSectors = (seatMap?.sectors ?? []).filter(
    (sector) => sector.mapData?.visible !== false,
  );
  const eventUsesSeatMap = setupMode === "SEAT_MAP" && activeSectors.length > 0;
  const selectedSector = activeSectors.find(
    (sector) => sector.id === formState.eventSectorId,
  );
  const requestedSectorExists = requestedSectorId
    ? activeSectors.some((sector) => sector.id === requestedSectorId)
    : true;
  const selectedSectorType = selectedSector?.sectorType === "SEATED" ? "SEATED" : "STANDING";
  const isAssignedSeatTicket = eventUsesSeatMap && selectedSectorType === "SEATED";

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!eventId) {
      return;
    }

    if (eventUsesSeatMap && !formState.eventSectorId.trim()) {
      toast.error("Chọn khu vực áp dụng cho loại vé.");
      return;
    }

    if (eventUsesSeatMap && !selectedSector) {
      toast.error("Khu vực này chưa được publish. Hãy publish sector trước khi tạo loại vé.");
      return;
    }

    const payload = toPayload(
      formState,
      isAssignedSeatTicket ? 0 : undefined,
      isAssignedSeatTicket,
      eventUsesSeatMap,
    );
    if (!payload) {
      toast.error(
        isAssignedSeatTicket
          ? "Điền đủ tên vé, giá và chọn khu ghế ngồi đã có ghế."
          : "Điền đủ tên vé, giá và số lượng.",
      );
      return;
    }

    if (
      payload.saleStartDatetime &&
      payload.saleEndDatetime &&
      new Date(payload.saleEndDatetime) <= new Date(payload.saleStartDatetime)
    ) {
      toast.error("Thời gian kết thúc bán phải lớn hơn thời gian bắt đầu.");
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(editingId);
      const nextTicketType = editingId
        ? await organizerWorkspaceService.updateTicketType(
            eventId,
            editingId,
            payload,
          )
        : await organizerWorkspaceService.createTicketType(eventId, payload);

      setTicketTypes((current) => {
        if (editingId) {
          return current.map((ticketType) =>
            ticketType.id === editingId ? nextTicketType : ticketType,
          );
        }

        return [nextTicketType, ...current];
      });

      resetForm();
      toast.success(
        isEditing ? "Cập nhật loại vé thành công." : "Tạo loại vé thành công.",
      );
    } catch {
      toast.error(
        editingId ? "Không thể cập nhật loại vé." : "Không thể tạo loại vé.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ticketType: OrganizerTicketType) => {
    setEditingId(ticketType.id);
    setFormState(buildFormState(ticketType));
    setIsCreateFormOpen(true);
  };

  const handleDelete = async (ticketType: OrganizerTicketType) => {
    if (!eventId) {
      return;
    }

    const confirmed = await confirmDestructiveAction({
      title: "Xóa loại vé này?",
      text: "Loại vé sẽ bị gỡ khỏi sự kiện. Kiểm tra kỹ trước khi xóa nếu event đã mở bán.",
      confirmButtonText: "Xóa loại vé",
      cancelButtonText: "Giữ lại",
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(ticketType.id);
    try {
      await organizerWorkspaceService.deleteTicketType(eventId, ticketType.id);
      setTicketTypes((current) =>
        current.filter((item) => item.id !== ticketType.id),
      );
      if (editingId === ticketType.id) {
        resetForm();
      }
      toast.success("Đã xóa loại vé.");
    } catch {
      toast.error("Không thể xóa loại vé.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTicketTypes = ticketTypes.filter((ticketType) => {
    const keyword = ticketSearch.trim().toLowerCase();
    if (!keyword) return true;

    return [
      ticketType.name,
      ticketType.description,
      ticketType.colorCode,
      ticketType.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  return (
    <OrganizerLayout
      title="Quản lý loại vé"
      description="Quản lý các loại vé của sự kiện."
      hideTopBar
    >
      {eventId ? <OrganizerEventWorkspaceNav eventId={eventId} /> : null}

      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải danh sách loại vé...</p>
        </section>
      ) : (
        <>
          {requestedSetupMode === "SEAT_MAP" && !requestedSectorExists ? (
            <section className="organizer-panel organizer-empty-state compact">
              <p>Khu vực vừa chọn chưa được publish. Hãy publish sector trong Seat map trước khi tạo loại vé cho khu đó.</p>
            </section>
          ) : null}
          {setupMode === null ? (
              <section
                className="organizer-panel organizer-ticket-setup-panel"
                aria-labelledby="organizer-ticket-setup-title"
              >
                <div className="organizer-panel-heading">
                  <h2 id="organizer-ticket-setup-title">
                    Bạn có cần sơ đồ khu vực hoặc ghế không?
                  </h2>
                </div>
                <div className="organizer-ticket-setup-actions">
                  <button
                    type="button"
                    className="organizer-ticket-setup-option"
                    onClick={handleChooseQuantityMode}
                  >
                    <span aria-hidden="true">○</span>
                    <div>
                      <strong>Không dùng sơ đồ</strong>
                      <p>Bán vé theo số lượng.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="organizer-ticket-setup-option"
                    onClick={handleChooseSeatMapMode}
                  >
                    <span aria-hidden="true">○</span>
                    <div>
                      <strong>Dùng sơ đồ</strong>
                      <p>
                        Tạo khu đứng, khu tự do, khu ghế ngồi hoặc kết hợp.
                      </p>
                    </div>
                  </button>
                </div>
              </section>
          ) : null}
          {isCreateFormOpen ? (
            <div className="organizer-media-modal-backdrop" role="presentation">
              <section
                className="organizer-ticket-form-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="organizer-ticket-form-title"
              >
                <div className="organizer-media-modal-header">
                  <h2 id="organizer-ticket-form-title">
                    {editingId ? "Cập nhật vé sự kiện" : "Tạo vé sự kiện"}
                  </h2>
                  <button
                    type="button"
                    className="organizer-media-modal-close"
                    aria-label="Đóng popup tạo vé"
                    onClick={resetForm}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form
                  className="organizer-media-modal-body organizer-event-form organizer-ticket-form-body"
                  onSubmit={handleSubmit}
                >
              <div className="organizer-form-grid">
                <label className="organizer-field organizer-form-span-2">
                  <span>Tên loại vé</span>
                  <input
                    className="organizer-input"
                    value={formState.name}
                    onChange={(event) =>
                      handleChange("name", event.target.value)
                    }
                    placeholder="Ví dụ: Early Bird, VIP, Standard"
                  />
                </label>

                <label className="organizer-field organizer-form-span-2">
                  <span>Mô tả</span>
                  <textarea
                    className="organizer-input organizer-textarea organizer-textarea-sm"
                    value={formState.description}
                    onChange={(event) =>
                      handleChange("description", event.target.value)
                    }
                    placeholder="Mô tả chi tiết về loại vé"
                  />
                </label>

                <label className="organizer-field">
                  <span>Giá bán</span>
                  <input
                    type="number"
                    min={0}
                    className="organizer-input"
                    value={formState.price}
                    onChange={(event) =>
                      handleChange("price", event.target.value)
                    }
                    placeholder="Giá bán của loại vé"
                  />
                </label>

                <label className="organizer-field">
                  <span>Giá gốc</span>
                  <input
                    type="number"
                    min={0}
                    className="organizer-input"
                    value={formState.originalPrice}
                    onChange={(event) =>
                      handleChange("originalPrice", event.target.value)
                    }
                    placeholder="Giá gốc của loại vé"
                  />
                </label>

                <label className="organizer-field">
                  <span>Số lượng</span>
                  <input
                    type="number"
                    min={0}
                    className="organizer-input"
                    value={isAssignedSeatTicket ? "0" : formState.quantityTotal}
                    readOnly={isAssignedSeatTicket}
                    onChange={(event) =>
                      handleChange("quantityTotal", event.target.value)
                    }
                    placeholder={
                      isAssignedSeatTicket
                        ? "Tự tính từ số ghế active"
                        : "Số lượng vé"
                    }
                  />
                  {isAssignedSeatTicket ? (
                    <small className="organizer-inline-help">
                      Backend sẽ đồng bộ số lượng sau khi ghế được gán loại vé và publish seat map.
                    </small>
                  ) : null}
                </label>

                <label className="organizer-field">
                  <span>Tối đa mỗi đơn</span>
                  <input
                    type="number"
                    min={1}
                    className="organizer-input"
                    value={formState.maxPerOrder}
                    onChange={(event) =>
                      handleChange("maxPerOrder", event.target.value)
                    }
                  />
                </label>


                <label className="organizer-field">
                  <span>Mở bán từ</span>
                  <input
                    type="datetime-local"
                    className="organizer-input"
                    value={formState.saleStartDatetime}
                    onChange={(event) =>
                      handleChange("saleStartDatetime", event.target.value)
                    }
                  />
                </label>

                <label className="organizer-field">
                  <span>Kết thúc bán</span>
                  <input
                    type="datetime-local"
                    className="organizer-input"
                    value={formState.saleEndDatetime}
                    onChange={(event) =>
                      handleChange("saleEndDatetime", event.target.value)
                    }
                  />
                </label>

                <label className="organizer-field">
                  <span>Thứ tự hiển thị</span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="number"
                      className="organizer-input"
                      value={formState.displayOrder}
                      onChange={(event) =>
                        handleChange("displayOrder", event.target.value)
                      }
                      style={{ flex: 1 }}
                    />
                    <div style={{ position: "relative", width: "48px", height: "48px", flexShrink: 0 }}>
                      <input
                        type="color"
                        value={formState.colorCode}
                        onChange={(event) =>
                          handleChange("colorCode", event.target.value)
                        }
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          opacity: 0,
                          cursor: "pointer",
                          zIndex: 2,
                        }}
                        title="Chọn màu hiển thị"
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundColor: formState.colorCode,
                          borderRadius: "16px",
                          border: "1px solid #cbd5e1",
                          zIndex: 1,
                        }}
                      />
                    </div>
                  </div>
                </label>

                {eventUsesSeatMap ? (
                  <label className="organizer-field organizer-form-span-2">
                    <span>Thuộc khu vực nào?</span>
                    <select
                      className="organizer-input"
                      value={formState.eventSectorId}
                      onChange={(event) =>
                        handleChange("eventSectorId", event.target.value)
                      }
                    >
                      <option value="">Chọn khu vực</option>
                      {activeSectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name} - {sector.sectorType === "SEATED" ? "Khu ghế ngồi" : "Khu tự do / khu đứng"}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="organizer-checkbox-grid organizer-form-span-2">
                  <label className="organizer-checkbox-card">
                    <input
                      type="checkbox"
                      checked={formState.isVisible}
                      onChange={(event) =>
                        handleChange("isVisible", event.target.checked)
                      }
                    />
                    <div>
                      <strong>Hiển thị công khai</strong>
                      <p>
                        Tắt nếu muốn ẩn loại vé trên storefront nhưng vẫn giữ dữ
                        liệu.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="organizer-form-actions organizer-ticket-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary organizer-inline-button"
                  onClick={resetForm}
                  style={{ flex: 1 }}
                >
                  {editingId ? "Hủy chỉnh sửa" : "Đóng form"}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary organizer-action-button"
                  disabled={saving}
                  style={{ flex: 1, margin: 0 }}
                >
                  {saving
                    ? "Đang lưu"
                    : editingId
                      ? "Cập nhật loại vé"
                      : "Tạo loại vé"}
                </button>
              </div>
                </form>
              </section>
            </div>
          ) : null}

          {setupMode !== null ? (
            <section className="organizer-panel">
            <div className="organizer-panel-heading-row organizer-ticket-header-row">
              <div className="organizer-ticket-header-actions">
                <label className="organizer-events-list-search organizer-ticket-search">
                  <input
                    value={ticketSearch}
                    onChange={(event) => setTicketSearch(event.target.value)}
                    className="organizer-events-list-search-input"
                    placeholder="Tìm loại vé..."
                  />
                  <span
                    className="organizer-events-list-search-button organizer-ticket-search-icon"
                    aria-hidden="true"
                  >
                    <Search size={14} />
                  </span>
                </label>
                <button
                  type="button"
                  className="organizer-events-add-button organizer-ticket-create-button"
                  onClick={handleCreateClick}
                >
                  Tạo vé sự kiện
                </button>
              </div>
            </div>
            {ticketTypes.length === 0 ? (
              <div className="organizer-empty-state compact">
                <p>Event này chưa có loại vé nào</p>
              </div>
            ) : filteredTicketTypes.length === 0 ? (
              <div className="organizer-empty-state compact">
                <p>Không có loại vé nào phù hợp</p>
              </div>
            ) : (
              <div className="organizer-ticket-table-wrap">
                <table className="organizer-ticket-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên loại vé</th>
                      <th>Màu vé</th>
                      <th>Giá bán</th>
                      <th>Giá gốc</th>
                      <th>Số lượng</th>
                      <th>Còn lại</th>
                      <th>Mở bán</th>
                      <th>Kết thúc bán</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTicketTypes.map((ticketType, index) => {
                      const statusMeta = getTicketTypeStatusMeta(
                        ticketType.status,
                      );

                      return (
                        <tr key={ticketType.id}>
                          <td>{index + 1}</td>
                          <td className="organizer-ticket-name-cell">
                            <strong>{ticketType.name}</strong>
                            <span>
                              {ticketType.description || "Chưa có mô tả."}
                            </span>
                          </td>
                          <td className="organizer-ticket-color-cell">
                            <span
                              className="organizer-ticket-color-dot"
                              style={{
                                backgroundColor: ticketType.colorCode || "#16a34a",
                              }}
                            />
                            <span>
                              {(ticketType.colorCode || "#16a34a").toUpperCase()}
                            </span>
                          </td>
                          <td>{formatMoney(ticketType.price)}</td>
                          <td>
                            {ticketType.originalPrice
                              ? formatMoney(ticketType.originalPrice)
                              : "-"}
                          </td>
                          <td>{ticketType.quantityTotal ?? 0}</td>
                          <td>{ticketType.quantityAvailable ?? 0}</td>
                          <td>
                            {formatDateTime(ticketType.saleStartDatetime)}
                          </td>
                          <td>{formatDateTime(ticketType.saleEndDatetime)}</td>
                          <td>
                            <span
                              className={`organizer-status-badge ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </td>
                          <td>
                            <div className="organizer-ticket-table-actions">
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  boxShadow: "none",
                                  padding: "8px",
                                  cursor: "pointer",
                                  color: "#19454F"
                                }}
                                title="Chỉnh sửa"
                                onClick={() => handleEdit(ticketType)}
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  boxShadow: "none",
                                  padding: "8px",
                                  cursor: "pointer",
                                  color: "#ef4444",
                                  opacity: deletingId === ticketType.id ? 0.5 : 1
                                }}
                                title="Xóa"
                                onClick={() => handleDelete(ticketType)}
                                disabled={deletingId === ticketType.id}
                              >
                                {deletingId === ticketType.id ? (
                                  <span className="loading-spinner" style={{ width: 16, height: 16 }} />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </section>
          ) : null}
        </>
      )}
    </OrganizerLayout>
  );
}

