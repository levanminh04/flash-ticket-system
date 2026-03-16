import { FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Eye, ImagePlus, LoaderCircle, Search, Trash2 } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useDropzone } from "react-dropzone";
import Swal from "sweetalert2";
import AppPagination from "../../components/common/AppPagination";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { eventService } from "../../services/eventService";
import {
  organizerService,
  OrganizerEventImage,
  OrganizerImageType,
} from "../../services/organizerService";
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

type ResolvedEvent = {
  id: string;
  title: string;
  slug: string;
  bannerUrl?: string;
  organizerName?: string;
};

export default function OrganizerMediaPage() {
  const [lookupValue, setLookupValue] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [resolvedEvent, setResolvedEvent] = useState<ResolvedEvent | null>(null);
  const [images, setImages] = useState<OrganizerEventImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<OrganizerImageType>("BANNER");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
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
      setSelectedPreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => setSelectedPreviewUrl(null);
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
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

  const resolveEvent = async () => {
    const value = lookupValue.trim();
    if (!value) {
      toast.error("Nhập slug hoặc event ID trước khi tải thư viện ảnh.");
      return;
    }

    setLookupLoading(true);
    try {
      const event = await eventService.getEventDetails(value);
      const nextEvent: ResolvedEvent = {
        id: String(event.id),
        title: String(event.title ?? "Sự kiện chưa đặt tên"),
        slug: String(event.slug ?? value),
        bannerUrl:
          event.images?.find(
            (image: { type?: string; url?: string }) => image.type === "BANNER",
          )?.url ?? event.bannerUrl,
        organizerName: event.organizer?.name,
      };

      setResolvedEvent(nextEvent);
      await loadImages(nextEvent.id);
      toast.success("Đã tải thư viện ảnh của sự kiện.");
    } catch {
      setResolvedEvent(null);
      setImages([]);
      setCurrentPage(0);
      toast.error("Không tìm thấy sự kiện theo slug hoặc ID đã nhập.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleUpload = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!resolvedEvent) {
      toast.error("Hãy tải sự kiện trước khi upload ảnh.");
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
      toast.error(
        "Upload ảnh thất bại",
      );
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
      description="Người dùng có thể tìm sự kiện bằng slug hoặc UUID, sau đó tải lên và quản lý các loại hình ảnh mà hệ thống hỗ trợ cho sự kiện."
    >
      <section className="organizer-panel organizer-lookup-panel">
        <div className="organizer-panel-heading">
          <div className="organizer-panel-heading-row">
            <h2 className="organizer-panel-title-pill">Tải sự kiện</h2>
          </div>
          <p>
            Người dùng nhập slug hoặc UUID của sự kiện, hệ thống xác định ID sự
            kiện tương ứng để thực hiện các thao tác quản lý hình ảnh.
          </p>
        </div>

        <div className="organizer-search-row">
          <input
            value={lookupValue}
            onChange={(changeEvent) => setLookupValue(changeEvent.target.value)}
            className="organizer-input organizer-search-input"
            placeholder="Hãy nhập slug hoặc UUID của sự kiện"
          />
          <button
            className="btn btn-primary organizer-search-button"
            onClick={() => void resolveEvent()}
            disabled={lookupLoading}
          >
            {lookupLoading ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Search size={16} />
            )}
            Tìm kiếm sự kiện
          </button>
        </div>
      </section>

      {resolvedEvent ? (
        <>
          <section className="organizer-event-banner">
            <div className="organizer-event-copy">
              <span className="organizer-badge">Event đã kết nối</span>
              <h2>{resolvedEvent.title}</h2>
              <p>
                Event ID: <strong>{resolvedEvent.id}</strong>
              </p>
              <p> Slug: <strong>{resolvedEvent.slug}</strong> </p>
              <p>BTC: <strong>{resolvedEvent.organizerName ? ` ${resolvedEvent.organizerName}` : ""}</strong></p>
            </div>
            <div className="organizer-event-art">
              {resolvedEvent.bannerUrl ? (
                <img src={resolvedEvent.bannerUrl} alt={resolvedEvent.title} />
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
                    onChange={(changeEvent) =>
                      setSelectedType(changeEvent.target.value as OrganizerImageType)
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
                      className: `organizer-input organizer-dropzone${isDragActive ? " is-active" : ""
                        }${isDragReject ? " is-reject" : ""}${selectedFile ? " has-file" : ""
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
                        <img src={selectedPreviewUrl} alt={selectedFile?.name ?? "preview"} />
                        <p className="organizer-dropzone-file-name">{selectedFile?.name}</p>
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
                <h2 className="organizer-panel-title-pill">Thư viện hiện tại</h2>
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
                          const imageIndex = currentPage * IMAGES_PER_PAGE + index;
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
