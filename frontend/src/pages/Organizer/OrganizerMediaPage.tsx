import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Calendar,
  Eye,
  ImagePlus,
  LoaderCircle,
  Edit,
  MapPin,
  Search,
  Trash2,
} from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useDropzone } from "react-dropzone";
import Swal from "sweetalert2";
import AppPagination from "../../components/common/AppPagination";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  organizerService,
  OrganizerEventImage,
  OrganizerImageType,
} from "../../services/organizerService";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
} from "../../services/organizerWorkspaceService";
import { confirmDestructiveAction } from "../../lib/swal";

const imageTypes: OrganizerImageType[] = [
  "BANNER",
  "POSTER",
  "THUMBNAIL",
  "GALLERY",
  "SEAT_MAP",
];
const IMAGES_PER_PAGE = 6;

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(dateTime?: string | null) {
  if (!dateTime) return "-";
  const parsedDate = new Date(dateTime);
  if (Number.isNaN(parsedDate.getTime())) return dateTime;
  return parsedDate.toLocaleString("vi-VN", { hour12: false });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isOrganizerImageType(value: string): value is OrganizerImageType {
  return imageTypes.includes(value as OrganizerImageType);
}

function resolveBannerUrl(event: OrganizerEventDetail) {
  return (
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url
  );
}

function formatEventLocation(event: OrganizerEventDetail) {
  const parts = [event.venue?.name, event.venue?.city]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .map((part) => part.trim());

  return Array.from(new Set(parts)).join(", ") || "Chưa cập nhật địa điểm";
}

function formatEventDate(event: OrganizerEventDetail) {
  const start = event.schedule?.startDatetime;
  if (!start) return "Chưa cập nhật lịch diễn";
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return start;
  return parsed.toLocaleDateString("vi-VN");
}

export default function OrganizerMediaPage() {
  const [events, setEvents] = useState<OrganizerEventDetail[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState("");
  const [resolvedEvent, setResolvedEvent] = useState<OrganizerEventDetail | null>(
    null,
  );
  const [images, setImages] = useState<OrganizerEventImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] =
    useState<OrganizerImageType>("BANNER");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(0);

  const setFileWithPreview = (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      setSelectedPreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedPreviewUrl(
        typeof reader.result === "string" ? reader.result : null,
      );
    };
    reader.onerror = () => setSelectedPreviewUrl(null);
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      multiple: false,
      maxFiles: 1,
      accept: {
        "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      },
      onDrop: (acceptedFiles) => {
        setFileWithPreview(acceptedFiles[0] ?? null);
      },
      onDropRejected: () => {
        setFileWithPreview(null);
        toast.error("Chỉ hỗ trợ 1 ảnh định dạng PNG, JPG hoặc WEBP.");
      },
    });

  const filteredEvents = useMemo(() => {
    const keyword = eventSearch.trim().toLowerCase();
    if (!keyword) return events;

    return events.filter((event) =>
      [event.title, event.slug, event.venue?.name, event.venue?.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [eventSearch, events]);

  const loadImages = async (eventId: string) => {
    setImagesLoading(true);
    try {
      const data = await organizerService.getEventImages(eventId);
      setImages(data);
      setCurrentPage(0);
    } catch {
      setImages([]);
      setCurrentPage(0);
      toast.error("Không thể tải thư viện ảnh của sự kiện.");
    } finally {
      setImagesLoading(false);
    }
  };

  const handleSelectEvent = async (event: OrganizerEventDetail) => {
    setResolvedEvent(event);
    setFileWithPreview(null);
    await loadImages(event.id);
  };

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const page = await organizerWorkspaceService.getMyEvents(0, 100);
        if (cancelled) return;
        setEvents(page.content);
        if (page.content.length > 0) {
          setResolvedEvent(page.content[0]);
          await loadImages(page.content[0].id);
        } else {
          setResolvedEvent(null);
          setImages([]);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
          setResolvedEvent(null);
          setImages([]);
          toast.error("Không thể tải danh sách sự kiện của organizer.");
        }
      } finally {
        if (!cancelled) {
          setEventsLoading(false);
        }
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!resolvedEvent) {
      toast.error("Hãy chọn sự kiện trước khi upload ảnh.");
      return;
    }
    if (!selectedFile) {
      toast.error("Chọn một ảnh trước khi tải lên.");
      return;
    }

    setUploading(true);
    try {
      await organizerService.uploadEventImage(
        resolvedEvent.id,
        selectedFile,
        selectedType,
      );
      setFileWithPreview(null);
      await loadImages(resolvedEvent.id);
      toast.success("Upload ảnh thành công.");
    } catch {
      toast.error("Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!resolvedEvent) return;

    const confirmed = await confirmDestructiveAction({
      title: "Xóa ảnh khỏi sự kiện?",
      text: "Ảnh sẽ bị xóa khỏi thư viện sự kiện và thao tác này không thể hoàn tác.",
      confirmButtonText: "Xóa ảnh",
      cancelButtonText: "Giữ lại",
    });
    if (!confirmed) return;

    setDeletingId(imageId);
    try {
      await organizerService.deleteEventImage(resolvedEvent.id, imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
      toast.success("Đã xóa ảnh khỏi sự kiện.");
    } catch {
      toast.error("Không thể xóa ảnh này.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewDetails = async (image: OrganizerEventImage) => {
    const details: Array<[string, string]> = [
      ["ID", image.id],
      ["Loại", image.imageType],
      ["URL", image.imageUrl],
      ["Public ID", image.publicId ?? "-"],
      ["Alt text", image.altText ?? "-"],
      [
        "Kích thước",
        image.width && image.height ? `${image.width} × ${image.height}` : "-",
      ],
      ["Dung lượng", formatBytes(image.fileSizeBytes)],
      ["Primary", image.isPrimary ? "Yes" : "No"],
      ["Display order", String(image.displayOrder ?? "-")],
      ["Created at", formatDateTime(image.createdAt)],
      ["Created by", image.createdBy ?? "-"],
      ["Deleted", image.isDeleted ? "Yes" : "No"],
    ];

    const detailsHtml = details
      .map(
        ([label, value]) =>
          `<div style="display:grid;grid-template-columns:140px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#0f172a;">${escapeHtml(label)}</strong>
            <span style="color:#334155;word-break:break-word;">${escapeHtml(value)}</span>
          </div>`,
      )
      .join("");

    await Swal.fire({
      title: "Chi tiết ảnh",
      html: `<div class="organizer-image-details-scroll">${detailsHtml}</div>`,
      width: 700,
      showConfirmButton: false,
      showCloseButton: true,
      closeButtonAriaLabel: "Đóng",
      heightAuto: false,
    });
  };

  const handleEditMetadata = async (image: OrganizerEventImage) => {
    if (!resolvedEvent) return;

    const result = await Swal.fire({
      title: "Chỉnh sửa metadata ảnh",
      width: 640,
      html: `
        <div class="organizer-media-editor-popup">
          <label class="organizer-media-editor-field">
            <span>Alt text</span>
            <input id="swal-image-alt" class="swal2-input organizer-media-editor-input" value="${escapeHtml(image.altText ?? "")}" placeholder="Nhập alt text cho ảnh" />
          </label>
          <label class="organizer-media-editor-field">
            <span>Display order</span>
            <input id="swal-image-order" type="number" min="0" class="swal2-input organizer-media-editor-input" value="${escapeHtml(String(image.displayOrder ?? 0))}" />
          </label>
          <label class="organizer-media-editor-field">
            <span>Loại ảnh (Image type)</span>
            <select id="swal-image-type" class="organizer-media-editor-select">
              ${imageTypes.map((type) => `<option value="${type}" ${image.imageType === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </label>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Lưu thay đổi",
      cancelButtonText: "Hủy",
      preConfirm: () => {
        const altInput = document.getElementById(
          "swal-image-alt",
        ) as HTMLInputElement | null;
        const orderInput = document.getElementById(
          "swal-image-order",
        ) as HTMLInputElement | null;
        const typeInput = document.getElementById(
          "swal-image-type",
        ) as HTMLSelectElement | null;

        const nextImageType = typeInput?.value ?? "";
        if (!isOrganizerImageType(nextImageType)) {
          Swal.showValidationMessage("Loại ảnh không hợp lệ");
          return null;
        }

        const displayOrderText = orderInput?.value?.trim() ?? "";
        if (displayOrderText && Number.isNaN(Number(displayOrderText))) {
          Swal.showValidationMessage("Display order phải là số hợp lệ.");
          return null;
        }

        return {
          altText: altInput?.value?.trim() || null,
          displayOrder: displayOrderText ? Number(displayOrderText) : 0,
          imageType: nextImageType,
        };
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    try {
      await organizerService.updateEventImage(
        resolvedEvent.id,
        image.id,
        result.value,
      );
      await loadImages(resolvedEvent.id);
      toast.success("Cập nhật metadata ảnh.");
    } catch {
      toast.error("Không thể cập nhật metadata ảnh.");
    }
  };

  const lightboxSlides = images.map((image) => ({
    src: image.imageUrl,
    alt: image.altText ?? image.imageType,
  }));
  const pageCount = Math.ceil(images.length / IMAGES_PER_PAGE);
  const paginatedImages = images.slice(
    currentPage * IMAGES_PER_PAGE,
    (currentPage + 1) * IMAGES_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > 0 && currentPage >= pageCount) {
      setCurrentPage(pageCount - 1);
    }
  }, [currentPage, pageCount]);

  return (
    <OrganizerLayout
      title="Thư viện ảnh sự kiện"
      description="Chọn một sự kiện từ workspace organizer rồi quản lý banner, poster, thumbnail, gallery và seat map ngay trên cùng màn hình."
    >
      <section className="organizer-panel organizer-lookup-panel">
        <div className="organizer-panel-heading">
          <div className="organizer-panel-heading-row">
            <h2 className="organizer-panel-title-pill">Chọn sự kiện</h2>
          </div>
          <p>
            Danh sách bên dưới lấy trực tiếp từ workspace organizer. Chọn một sự
            kiện để xem và quản lý thư viện ảnh của sự kiện đó.
          </p>
        </div>

        <div className="organizer-search-row">
          <div className="organizer-search-input organizer-media-filter">
            <Search size={16} />
            <input
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              className="organizer-media-filter-input"
              placeholder="Tìm theo tên sự kiện, slug hoặc địa điểm"
            />
          </div>
        </div>

        {eventsLoading ? (
          <div className="organizer-empty-state">
            <div className="loading-spinner" />
            <p>Đang tải danh sách sự kiện của organizer...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="organizer-empty-state">
            <ImagePlus size={32} />
            <p>Không có sự kiện nào phù hợp để quản lý ảnh.</p>
          </div>
        ) : (
          <div className="organizer-media-event-grid">
            {filteredEvents.map((event) => {
              const isActive = resolvedEvent?.id === event.id;

              return (
                <button
                  key={event.id}
                  type="button"
                  className={`organizer-media-event-card${isActive ? " is-active" : ""}`}
                  onClick={() => void handleSelectEvent(event)}
                >
                  <div className="organizer-media-event-card__thumb">
                    {resolveBannerUrl(event) ? (
                      <img
                        src={resolveBannerUrl(event)}
                        alt={event.title}
                      />
                    ) : (
                      <div className="organizer-event-art-placeholder">
                        <ImagePlus size={24} />
                      </div>
                    )}
                  </div>
                  <div className="organizer-media-event-card__body">
                    <strong>{event.title}</strong>
                    <span>{event.slug}</span>
                    <span>
                      <Calendar size={14} /> {formatEventDate(event)}
                    </span>
                    <span>
                      <MapPin size={14} /> {formatEventLocation(event)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {resolvedEvent ? (
        <>
          <section className="organizer-event-banner">
            <div className="organizer-event-copy">
              <span className="organizer-badge">Event đã chọn</span>
              <h2>
                <strong>Tên sự kiện: </strong>
                {resolvedEvent.title}
              </h2>
              <p>
                <strong>Event ID: </strong>
                {resolvedEvent.id}
              </p>
              <p>
                <strong>Slug: </strong>
                {resolvedEvent.slug}
              </p>
              <p>
                <strong>BTC: </strong>
                {resolvedEvent.organizer?.name || "Chưa cập nhật"}
              </p>
            </div>
            <div className="organizer-event-art">
              {resolveBannerUrl(resolvedEvent) ? (
                <img
                  src={resolveBannerUrl(resolvedEvent)}
                  alt={resolvedEvent.title}
                />
              ) : (
                <div className="organizer-event-art-placeholder">
                  <ImagePlus size={32} />
                </div>
              )}
            </div>
          </section>

          <div className="organizer-media-stack">
            <form
              className="organizer-panel organizer-upload-form organizer-upload-form-horizontal"
              onSubmit={handleUpload}
            >
              <div className="organizer-panel-heading">
                <h2 className="organizer-panel-title-pill">Upload ảnh mới</h2>
              </div>

              <div className="organizer-upload-row">
                <label className="organizer-field">
                  <span>Loại ảnh</span>
                  <select
                    className="organizer-input"
                    value={selectedType}
                    onChange={(event) =>
                      setSelectedType(event.target.value as OrganizerImageType)
                    }
                  >
                    {imageTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="organizer-field">
                  <span>Tệp hình ảnh</span>
                  <div
                    {...getRootProps({
                      className: `organizer-input organizer-dropzone${
                        isDragActive ? " is-active" : ""
                      }${isDragReject ? " is-reject" : ""}${
                        selectedFile ? " has-file" : ""
                      }`,
                    })}
                  >
                    <input
                      {...getInputProps({
                        id: "organizer-image-file",
                        name: "organizer-image-file",
                      })}
                    />
                    {isDragReject ? (
                      <p className="organizer-dropzone-text">
                        Định dạng không hợp lệ. Chỉ hỗ trợ PNG, JPG, JPEG, WEBP.
                      </p>
                    ) : selectedPreviewUrl ? (
                      <div className="organizer-dropzone-preview">
                        <img
                          src={selectedPreviewUrl}
                          alt={selectedFile?.name ?? "preview"}
                        />
                        <p className="organizer-dropzone-file-name">
                          {selectedFile?.name}
                        </p>
                      </div>
                    ) : (
                      <p className="organizer-dropzone-text">
                        {isDragActive
                          ? "Thả ảnh vào đây..."
                          : "Kéo thả ảnh vào đây hoặc bấm để chọn"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="organizer-upload-submit-row">
                <button
                  className="btn btn-primary organizer-upload-button organizer-upload-button-rect"
                  disabled={uploading}
                >
                  {uploading ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  Tải ảnh lên
                </button>
              </div>
            </form>

            <section className="organizer-panel">
              <div className="organizer-panel-heading">
                <h2 className="organizer-panel-title-pill">
                  Thư viện hiện tại
                </h2>
              </div>

              {imagesLoading ? (
                <div className="organizer-empty-state">
                  <div className="loading-spinner" />
                  <p>Đang tải thư viện ảnh...</p>
                </div>
              ) : images.length === 0 ? (
                <div className="organizer-empty-state">
                  <ImagePlus size={32} />
                  <p>Sự kiện chưa có ảnh nào trong thư viện organizer.</p>
                </div>
              ) : (
                <>
                  <div className="organizer-media-table-wrap">
                    <table className="organizer-media-table">
                      <thead>
                        <tr>
                          <th>Ảnh</th>
                          <th>ID</th>
                          <th>Loại</th>
                          <th>Kích thước</th>
                          <th>Dung lượng</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedImages.map((image, index) => {
                          const imageIndex =
                            currentPage * IMAGES_PER_PAGE + index;

                          return (
                            <tr key={image.id}>
                              <td>
                                <button
                                  className="organizer-media-thumb organizer-media-thumb-trigger"
                                  type="button"
                                  onClick={() => setLightboxIndex(imageIndex)}
                                  aria-label="Xem ảnh lớn"
                                  title="Xem ảnh lớn"
                                >
                                  <img
                                    src={image.imageUrl}
                                    alt={image.altText ?? image.imageType}
                                  />
                                </button>
                              </td>
                              <td className="organizer-media-id" title={image.id}>
                                {image.id}
                              </td>
                              <td>
                                <div className="organizer-media-type-stack">
                                  <span
                                    className={`organizer-tag organizer-tag-${image.imageType
                                      .toLowerCase()
                                      .replace("_", "-")}`}
                                  >
                                    {image.imageType}
                                  </span>
                                  {image.isPrimary ? (
                                    <span className="organizer-tag organizer-tag-primary">
                                      Primary
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                {image.width && image.height
                                  ? `${image.width} × ${image.height}`
                                  : "-"}
                              </td>
                              <td>{formatBytes(image.fileSizeBytes)}</td>
                              <td className="organizer-media-action-cell">
                                <div className="organizer-media-actions">
                                  <button
                                    className="organizer-icon-action organizer-icon-action-info"
                                    onClick={() => void handleViewDetails(image)}
                                    type="button"
                                    aria-label="Xem chi tiết ảnh"
                                    title="Xem chi tiết ảnh"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button
                                    className="organizer-icon-action organizer-icon-action-edit"
                                    onClick={() => void handleEditMetadata(image)}
                                    type="button"
                                    aria-label="Chỉnh sửa metadata ảnh"
                                    title="Chỉnh sửa metadata ảnh"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    className="organizer-icon-action organizer-icon-action-danger"
                                    onClick={() => void handleDelete(image.id)}
                                    disabled={deletingId === image.id}
                                    type="button"
                                    aria-label="Xóa ảnh"
                                    title="Xóa ảnh"
                                  >
                                    {deletingId === image.id ? (
                                      <LoaderCircle size={16} className="spin" />
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
                  <div className="organizer-media-pagination">
                    <AppPagination
                      currentPage={currentPage}
                      pageCount={pageCount}
                      onPageChange={(page) => setCurrentPage(page)}
                    />
                  </div>
                </>
              )}
            </section>
          </div>

          <Lightbox
            open={lightboxIndex >= 0}
            close={() => setLightboxIndex(-1)}
            index={lightboxIndex >= 0 ? lightboxIndex : 0}
            slides={lightboxSlides}
          />
        </>
      ) : null}
    </OrganizerLayout>
  );
}
