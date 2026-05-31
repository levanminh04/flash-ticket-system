import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerService,
  OrganizerEventImage,
} from "../../services/organizerService";
import {
  LayoutSourceType,
  organizerWorkspaceService,
  OrganizerEventLayout,
  OrganizerLayoutPayload,
} from "../../services/organizerWorkspaceService";
import { useOrganizerGate } from "./useOrganizerGate";

type LayoutFormState = {
  name: string;
  backgroundImageUrl: string;
  backgroundPublicId: string;
  backgroundWidth: string;
  backgroundHeight: string;
  mapConfigText: string;
  sourceType: LayoutSourceType;
  sourceId: string;
};

const defaultFormState: LayoutFormState = {
  name: "",
  backgroundImageUrl: "",
  backgroundPublicId: "",
  backgroundWidth: "",
  backgroundHeight: "",
  mapConfigText: "{\n  \n}",
  sourceType: "CUSTOM",
  sourceId: "",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildFormState(layout: OrganizerEventLayout): LayoutFormState {
  return {
    name: layout.name || "",
    backgroundImageUrl: layout.backgroundImageUrl || "",
    backgroundPublicId: layout.backgroundPublicId || "",
    backgroundWidth: String(layout.backgroundWidth ?? ""),
    backgroundHeight: String(layout.backgroundHeight ?? ""),
    mapConfigText: JSON.stringify(layout.mapConfig ?? {}, null, 2),
    sourceType: (layout.sourceType as LayoutSourceType) || "CUSTOM",
    sourceId: layout.sourceId || "",
  };
}

function buildFormStateFromSeatMapImage(image: OrganizerEventImage): LayoutFormState {
  return {
    ...defaultFormState,
    name: "Sơ đồ ghế",
    backgroundImageUrl: image.imageUrl || "",
    backgroundPublicId: image.publicId || "",
    backgroundWidth: String(image.width ?? ""),
    backgroundHeight: String(image.height ?? ""),
  };
}

function getRequestErrorMessage(error: unknown) {
  const response = (error as { response?: { data?: unknown; status?: number } })?.response;
  const data = response?.data;

  if (data && typeof data === "object") {
    const message =
      (data as { message?: unknown; error?: unknown }).message ??
      (data as { message?: unknown; error?: unknown }).error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return response?.status ? `Request failed with status ${response.status}.` : "Request failed.";
}

function toPayload(formState: LayoutFormState): OrganizerLayoutPayload | null {
  try {
    const trimmedSourceId = formState.sourceId.trim();
    if (trimmedSourceId && !isUuid(trimmedSourceId)) {
      return null;
    }

    const mapConfig = formState.mapConfigText.trim()
      ? (JSON.parse(formState.mapConfigText) as Record<string, unknown>)
      : {};

    return {
      name: formState.name.trim() || undefined,
      backgroundImageUrl: formState.backgroundImageUrl.trim() || undefined,
      backgroundPublicId: formState.backgroundPublicId.trim() || undefined,
      backgroundWidth: formState.backgroundWidth
        ? Number(formState.backgroundWidth)
        : undefined,
      backgroundHeight: formState.backgroundHeight
        ? Number(formState.backgroundHeight)
        : undefined,
      mapConfig,
      sourceType: formState.sourceType,
      sourceId: trimmedSourceId || undefined,
    };
  } catch {
    return null;
  }
}

export default function OrganizerLayoutPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { ready } = useOrganizerGate();
  const [layout, setLayout] = useState<OrganizerEventLayout | null>(null);
  const [formState, setFormState] = useState<LayoutFormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [backgroundLightboxOpen, setBackgroundLightboxOpen] = useState(false);

  const backgroundLightboxSlides = useMemo(
    () =>
      formState.backgroundImageUrl.trim()
        ? [
            {
              src: formState.backgroundImageUrl.trim(),
              alt: formState.name || "Layout background",
            },
          ]
        : [],
    [formState.backgroundImageUrl, formState.name],
  );

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const load = async () => {
      if (!eventId) return;

      setLoading(true);
      try {
        const [nextLayout, nextImages] = await Promise.all([
          organizerWorkspaceService.getLayout(eventId),
          organizerService.getEventImages(eventId).catch(() => []),
        ]);

        if (!cancelled) {
          const seatMapImage = nextImages.find((image) => image.imageType === "SEAT_MAP");
          setLayout(nextLayout);
          setFormState(
            nextLayout
              ? buildFormState(nextLayout)
              : seatMapImage
                ? buildFormStateFromSeatMapImage(seatMapImage)
                : defaultFormState,
          );
        }
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải layout của sự kiện.");
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

  const handleChange = <K extends keyof LayoutFormState>(
    key: K,
    value: LayoutFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!eventId || saving) return;

    const payload = toPayload(formState);
    if (!payload) {
      toast.error("Map config hoặc Source ID chưa hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const nextLayout = layout
        ? await organizerWorkspaceService.updateLayout(eventId, payload)
        : await organizerWorkspaceService.createLayout(eventId, payload);

      setLayout(nextLayout);
      setFormState(buildFormState(nextLayout));
      toast.success(layout ? "Cập nhật layout thành công." : "Tạo layout thành công.");
    } catch (error) {
      const message = getRequestErrorMessage(error);
      toast.error(
        layout
          ? `Không thể cập nhật layout. ${message}`
          : `Không thể tạo layout. ${message}`,
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleSave = () => {
      const mockEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
      void handleSubmit(mockEvent);
    };
    document.addEventListener("organizer-save-event", handleSave);
    return () => {
      document.removeEventListener("organizer-save-event", handleSave);
    };
  }, [formState, layout, eventId, saving]);

  const handleDelete = async () => {
    if (!eventId || !layout) return;

    const confirmed = await confirmDestructiveAction({
      title: "Xóa layout của sự kiện?",
      text: "Layout hiện tại sẽ bị gỡ khỏi event. Dữ liệu seat-map liên quan có thể bị ảnh hưởng khi organizer tiếp tục cấu hình.",
      confirmButtonText: "Xóa layout",
      cancelButtonText: "Giữ lại",
    });

    if (!confirmed) return;

    setDeleting(true);
    try {
      await organizerWorkspaceService.deleteLayout(eventId);
      setLayout(null);
      setFormState(defaultFormState);
      toast.success("Đã xóa layout.");
    } catch {
      toast.error("Không thể xóa layout.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <OrganizerLayout
      title="Quản lý layout"
      description="Thiết lập sơ đồ và ảnh nền."
      actions={null}
      hideTopBar
      showWorkflowNav={Boolean(eventId)}
      eventId={eventId}
      className="organizer-layout-page"
    >

      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải layout sự kiện...</p>
        </section>
      ) : (
        <section className="organizer-grid organizer-layout-editor-single">
          <form className="organizer-panel organizer-event-form" onSubmit={handleSubmit}>
            <div className="organizer-form-grid">
              <label className="organizer-field organizer-form-span-2">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Tên layout
                </span>
                <input
                  className="organizer-input"
                  value={formState.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="Nhập tên layout"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Background image URL
                </span>
                <div className="organizer-layout-url-field">
                  {formState.backgroundImageUrl.trim() ? (
                    <button
                      type="button"
                      className="organizer-layout-url-preview-button"
                      onClick={() => setBackgroundLightboxOpen(true)}
                      aria-label="Xem ảnh nền ở kích thước lớn"
                      title="Xem ảnh nền"
                    >
                      <img
                        src={formState.backgroundImageUrl}
                        alt={formState.name || "Layout thumbnail"}
                      />
                    </button>
                  ) : (
                    <div className="organizer-layout-url-thumbnail-placeholder" />
                  )}
                  <input
                    className="organizer-input"
                    value={formState.backgroundImageUrl}
                    onChange={(event) => handleChange("backgroundImageUrl", event.target.value)}
                    placeholder="Dán URL ảnh seat map hoặc nền sơ đồ"
                  />
                </div>
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Background public ID
                </span>
                <input
                  className="organizer-input"
                  value={formState.backgroundPublicId}
                  onChange={(event) => handleChange("backgroundPublicId", event.target.value)}
                  placeholder="Nhập public ID của ảnh"
                />
              </label>
              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Source type
                </span>
                <select
                  className="organizer-input"
                  value={formState.sourceType}
                  onChange={(event) =>
                    handleChange("sourceType", event.target.value as LayoutSourceType)
                  }
                >
                  <option value="CUSTOM">CUSTOM</option>
                  <option value="CLONED_FROM_VENUE">CLONED_FROM_VENUE</option>
                  <option value="CLONED_FROM_EVENT">CLONED_FROM_EVENT</option>
                </select>
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Width
                </span>
                <input
                  type="number"
                  className="organizer-input"
                  value={formState.backgroundWidth}
                  onChange={(event) => handleChange("backgroundWidth", event.target.value)}
                  placeholder="Nhập width của ảnh"
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Height
                </span>
                <input
                  type="number"
                  className="organizer-input"
                  value={formState.backgroundHeight}
                  onChange={(event) => handleChange("backgroundHeight", event.target.value)}
                  placeholder="Nhập height của ảnh"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Source ID</span>
                <input
                  className="organizer-input"
                  value={formState.sourceId}
                  onChange={(event) => handleChange("sourceId", event.target.value)}
                  placeholder="Nhập source ID"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Map config JSON</span>
                <textarea
                  className="organizer-input organizer-textarea organizer-textarea-code"
                  value={formState.mapConfigText}
                  onChange={(event) => handleChange("mapConfigText", event.target.value)}
                  placeholder="Nhập map config JSON"
                />
              </label>
            </div>
            {layout ? (
              <div className="organizer-form-actions">
                <button
                  type="button"
                  className="btn btn-danger organizer-danger-button"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Đang xóa" : "Xóa layout"}
                </button>
              </div>
            ) : null}
          </form>

        </section>
      )}
      <Lightbox
        open={backgroundLightboxOpen && backgroundLightboxSlides.length > 0}
        close={() => setBackgroundLightboxOpen(false)}
        slides={backgroundLightboxSlides}
        index={0}
      />
    </OrganizerLayout>
  );
}
