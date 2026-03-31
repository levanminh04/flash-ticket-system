import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Edit, Trash2 } from "lucide-react";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import OrganizerEventWorkspaceNav from "../../components/organizer/OrganizerEventWorkspaceNav";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
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
): OrganizerTicketTypePayload | null {
  const price = Number(formState.price);
  const quantityTotal = Number(formState.quantityTotal);

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
    seatSelectionEnabled: formState.seatSelectionEnabled,
    colorCode: formState.colorCode || undefined,
    displayOrder: formState.displayOrder
      ? Number(formState.displayOrder)
      : undefined,
    eventSectorId: formState.eventSectorId.trim() || undefined,
    isVisible: formState.isVisible,
  };
}

export default function OrganizerTicketTypesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { ready } = useOrganizerGate();
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(
    null,
  );
  const [ticketTypes, setTicketTypes] = useState<OrganizerTicketType[]>([]);
  const [formState, setFormState] =
    useState<TicketTypeFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !eventId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextEvent, nextTicketTypes] = await Promise.all([
          organizerWorkspaceService.getMyEvent(eventId),
          organizerWorkspaceService.getTicketTypes(eventId),
        ]);

        if (cancelled) {
          return;
        }

        setEventDetail(nextEvent);
        setTicketTypes(nextTicketTypes);
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
  }, [eventId, ready]);

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

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!eventId) {
      return;
    }

    const payload = toPayload(formState);
    if (!payload) {
      toast.error("Điền đủ tên vé, giá và số lượng.");
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

  return (
    <OrganizerLayout
      title="Quản lý loại vé"
      description="Thêm, sửa và xóa các loại vé cho event hiện tại"
    >
      {eventId ? <OrganizerEventWorkspaceNav eventId={eventId} /> : null}

      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải loại vé</p>
        </section>
      ) : (
        <>
          <section className="organizer-panel organizer-toolbar-panel">
            <div className="organizer-panel-heading-row">
              <div>
                <p className="organizer-panel-title-pill">Ticket types</p>
                <h2 style={{ marginBottom: "4px" }}>
                  <strong>Tên sự kiện: </strong>
                  {eventDetail?.title || "Sự kiện chưa xác định"}
                </h2>
                <h2 style={{ marginTop: 0 }}>
                  <strong>Slug: </strong>
                  {eventDetail?.slug || "Sự kiện chưa xác định"}
                </h2>
              </div>
              <button
                type="button"
                className="btn"
                onClick={handleCreateClick}
                style={{
                  color: "#19454F",
                  fontWeight: 700,
                  background: "transparent",
                  border: "none",
                  padding: "8px 0",
                  alignSelf: "flex-start",
                  marginRight: "24px",
                  boxShadow: "none"
                }}
              >
                Tạo vé sự kiện
              </button>
            </div>
          </section>

          {isCreateFormOpen ? (
            <form
              className="organizer-panel organizer-event-form"
              onSubmit={handleSubmit}
            >
              <div className="organizer-panel-heading">
                <h2 className="organizer-panel-title-pill">
                  {editingId ? "Chỉnh sửa loại vé" : "Tạo loại vé mới"}
                </h2>
              </div>

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
                    value={formState.quantityTotal}
                    onChange={(event) =>
                      handleChange("quantityTotal", event.target.value)
                    }
                    placeholder="Số lượng vé"
                  />
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
                  <span>Màu hiển thị</span>
                  <input
                    type="color"
                    className="organizer-input"
                    value={formState.colorCode}
                    onChange={(event) =>
                      handleChange("colorCode", event.target.value)
                    }
                  />
                </label>

                <label className="organizer-field">
                  <span>Thứ tự hiển thị</span>
                  <input
                    type="number"
                    className="organizer-input"
                    value={formState.displayOrder}
                    onChange={(event) =>
                      handleChange("displayOrder", event.target.value)
                    }
                  />
                </label>

                <label className="organizer-field organizer-form-span-2">
                  <span>Event sector ID</span>
                  <input
                    className="organizer-input"
                    value={formState.eventSectorId}
                    onChange={(event) =>
                      handleChange("eventSectorId", event.target.value)
                    }
                    placeholder="Để trống nếu loại vé chưa gắn sector cụ thể"
                  />
                </label>

                <div className="organizer-checkbox-grid organizer-form-span-2">
                  <label className="organizer-checkbox-card">
                    <input
                      type="checkbox"
                      checked={formState.seatSelectionEnabled}
                      onChange={(event) =>
                        handleChange(
                          "seatSelectionEnabled",
                          event.target.checked,
                        )
                      }
                    />
                    <div>
                      <strong>Cho chọn ghế</strong>
                      <p>
                        Dùng khi ticket type gắn seat map hoặc sector có ghế.
                      </p>
                    </div>
                  </label>

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

              <div className="organizer-form-actions" style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "100%", gap: "16px" }}>
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
          ) : null}

          <section className="organizer-panel">
            <div className="organizer-panel-heading">
              <h2 className="organizer-panel-title-pill">Danh sách loại vé</h2>
            </div>

            {ticketTypes.length === 0 ? (
              <div className="organizer-empty-state compact">
                <p>Event này chưa có loại vé nào</p>
              </div>
            ) : (
              <div className="organizer-ticket-table-wrap">
                <table className="organizer-ticket-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên loại vé</th>
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
                    {ticketTypes.map((ticketType, index) => {
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
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                              <div
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  backgroundColor: ticketType.colorCode || "#16a34a",
                                }}
                              />
                              <span style={{ fontSize: "12px", fontWeight: 500, color: "#6b7280" }}>
                                {(ticketType.colorCode || "#16a34a").toUpperCase()}
                              </span>
                            </div>
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
        </>
      )}
    </OrganizerLayout>
  );
}
