import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { organizerWorkspaceService } from "../../services/organizerWorkspaceService";

type OrganizerEventWorkspaceNavProps = {
  eventId?: string;
};

type Step = {
  label: string;
  path: string;
};

const getOpenedWorkflowStepsKey = (eventId: string) =>
  `organizer-opened-workflow-steps:${eventId}`;

const getSeatMapPublishedKey = (eventId: string) =>
  `organizer-seat-map-published:${eventId}`;

const getSavedWorkflowStepKey = (pathname: string) =>
  `organizer-workflow-step-saved:${pathname}`;

const readOpenedWorkflowSteps = (eventId: string) => {
  try {
    const stored = sessionStorage.getItem(getOpenedWorkflowStepsKey(eventId));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export default function OrganizerEventWorkspaceNav({
  eventId,
}: OrganizerEventWorkspaceNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [setupMode, setSetupMode] = useState<string | null>(null);
  const [openedStepPaths, setOpenedStepPaths] = useState<string[]>([]);
  const [seatMapPublished, setSeatMapPublished] = useState(false);
  const [publishingEvent, setPublishingEvent] = useState(false);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [hasSavedCurrentStep, setHasSavedCurrentStep] = useState(false);
  const [savingSeatMap, setSavingSeatMap] = useState(false);
  const [seatMapSaveElapsedSeconds, setSeatMapSaveElapsedSeconds] = useState(0);

  // Sync setup mode from sessionStorage
  useEffect(() => {
    if (!eventId) {
      setSetupMode(null);
      return;
    }
    const key = `organizer-ticket-setup-mode:${eventId}`;
    const stored = sessionStorage.getItem(key);
    setSetupMode(stored);
    setSeatMapPublished(sessionStorage.getItem(getSeatMapPublishedKey(eventId)) === "true");
  }, [eventId, location.pathname]);

  useEffect(() => {
    if (!eventId) return;

    const handleSeatMapPublishedUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ eventId?: string; published?: boolean }>;
      if (customEvent.detail?.eventId !== eventId) return;
      setSeatMapPublished(Boolean(customEvent.detail.published));
    };

    document.addEventListener("organizer-seat-map-published-updated", handleSeatMapPublishedUpdate);
    return () => {
      document.removeEventListener("organizer-seat-map-published-updated", handleSeatMapPublishedUpdate);
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const handleSeatMapSaveStatus = (event: Event) => {
      const customEvent = event as CustomEvent<{ eventId?: string; saving?: boolean }>;
      if (customEvent.detail?.eventId !== eventId) return;

      const nextSaving = Boolean(customEvent.detail.saving);
      setSavingSeatMap(nextSaving);
      if (nextSaving) {
        setSeatMapSaveElapsedSeconds(0);
      }
    };

    document.addEventListener("organizer-workflow-seat-map-save-status", handleSeatMapSaveStatus);
    return () => {
      document.removeEventListener("organizer-workflow-seat-map-save-status", handleSeatMapSaveStatus);
    };
  }, [eventId]);

  useEffect(() => {
    if (!savingSeatMap) return;

    const timerId = window.setInterval(() => {
      setSeatMapSaveElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [savingSeatMap]);

  useEffect(() => {
    if (!eventId) {
      setOpenedStepPaths([]);
      return;
    }

    setOpenedStepPaths(readOpenedWorkflowSteps(eventId));
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      sessionStorage.removeItem(getSavedWorkflowStepKey(location.pathname));
      setHasSavedCurrentStep(false);
      return;
    }

    setHasSavedCurrentStep(sessionStorage.getItem(getSavedWorkflowStepKey(location.pathname)) === "true");
  }, [eventId, location.pathname]);

  useEffect(() => {
    if (!eventId) {
      setEventStatus(null);
      return;
    }

    let cancelled = false;
    organizerWorkspaceService
      .getMyEvent(eventId)
      .then((event) => {
        if (!cancelled) setEventStatus(event.status || null);
      })
      .catch(() => {
        if (!cancelled) setEventStatus(null);
      });

    const handleEventStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string; status?: string }>;
      if (customEvent.detail?.id !== eventId) return;
      setEventStatus(customEvent.detail.status || null);
    };

    document.addEventListener("organizer-event-status-updated", handleEventStatusUpdate);
    return () => {
      cancelled = true;
      document.removeEventListener("organizer-event-status-updated", handleEventStatusUpdate);
    };
  }, [eventId]);

  // Define steps dynamically based on selected setup mode
  const steps: Step[] = [
    {
      label: "Thông tin sự kiện",
      path: eventId ? `/organizer/events/${eventId}/edit` : "/organizer/events/new",
    },
    {
      label: "Ảnh sự kiện",
      path: eventId ? `/organizer/events/${eventId}/media` : "",
    },
  ];

  if (setupMode === "SEAT_MAP" && eventId) {
    steps.push(
      { label: "Layout", path: `/organizer/events/${eventId}/layout` },
      { label: "Sơ đồ ghế ngồi", path: `/organizer/events/${eventId}/seat-map` }
    );
  }

  steps.push({
    label: "Loại vé",
    path: eventId ? `/organizer/events/${eventId}/ticket-types` : "",
  });

  // Determine current active step
  const currentStepIndex = steps.findIndex((step) =>
    step.path && location.pathname.toLowerCase().endsWith(step.path.toLowerCase())
  );
  const isSeatMapTicketTypesStep =
    setupMode === "SEAT_MAP" &&
    currentStepIndex === steps.length - 1 &&
    Boolean(eventId);
  const isSeatMapWorkflowStep =
    setupMode === "SEAT_MAP" &&
    currentStepIndex === 3 &&
    Boolean(eventId);
  const isQuantityTicketTypesStep =
    setupMode === "QUANTITY" &&
    currentStepIndex === steps.length - 1 &&
    Boolean(eventId);
  const shouldShowContinueButton =
    !(isSeatMapTicketTypesStep && seatMapPublished && eventStatus === "PUBLISHED");

  useEffect(() => {
    if (!eventId || currentStepIndex === -1) return;

    const currentPath = steps[currentStepIndex]?.path;
    if (!currentPath) return;

    setOpenedStepPaths((previousPaths) => {
      if (previousPaths.includes(currentPath)) return previousPaths;

      const nextPaths = [...previousPaths, currentPath];
      sessionStorage.setItem(
        getOpenedWorkflowStepsKey(eventId),
        JSON.stringify(nextPaths),
      );
      return nextPaths;
    });
  }, [currentStepIndex, eventId, steps]);

  const handleSave = () => {
    if (savingSeatMap) return;

    // Dispatch custom event to notify the active form page to submit
    const saveEvent = new CustomEvent("organizer-save-event");
    document.dispatchEvent(saveEvent);
    if (!eventId) {
      sessionStorage.removeItem(getSavedWorkflowStepKey(location.pathname));
      setHasSavedCurrentStep(false);
      return;
    }

    setHasSavedCurrentStep(true);
    sessionStorage.setItem(getSavedWorkflowStepKey(location.pathname), "true");
  };

  const saveButtonLabel =
    isSeatMapWorkflowStep && savingSeatMap
      ? `Lưu..${String(seatMapSaveElapsedSeconds).padStart(2, "0")}`
      : "Lưu";

  const handlePublishEvent = async () => {
    if (!eventId || publishingEvent) return;

    setPublishingEvent(true);
    try {
      const nextEvent = await organizerWorkspaceService.publishEvent(eventId);
      setEventStatus(nextEvent.status || null);
      document.dispatchEvent(new CustomEvent("organizer-event-status-updated", { detail: nextEvent }));
      toast.success("Đã publish sự kiện");
      navigate("/organizer/events");
    } catch {
      toast.error("Không thể publish sự kiện.");
    } finally {
      setPublishingEvent(false);
    }
  };

  const resolvePublishedSetupMode = async () => {
    if (!eventId || eventStatus !== "PUBLISHED") {
      return null;
    }

    try {
      const [seatMap, layout] = await Promise.all([
        organizerWorkspaceService.getSeatMap(eventId).catch(() => null),
        organizerWorkspaceService.getLayout(eventId).catch(() => null),
      ]);
      return seatMap || layout ? "SEAT_MAP" : "QUANTITY";
    } catch {
      return "QUANTITY";
    }
  };

  const handleContinue = async () => {
    if (currentStepIndex === -1) return;

    if (!eventId) {
      toast.info("Vui lòng nhập đầy đủ thông tin để tạo sự kiện trước khi tiếp tục.");
      // Trigger save with nextStep: "media"
      const saveEvent = new CustomEvent("organizer-save-event", {
        detail: { nextStep: "media" },
      });
      document.dispatchEvent(saveEvent);
      return;
    }

    if (currentStepIndex === 0) {
      // Step 1: Info -> check setupMode
      const key = `organizer-ticket-setup-mode:${eventId}`;
      let currentMode = sessionStorage.getItem(key);

      if (!currentMode) {
        const publishedMode = await resolvePublishedSetupMode();
        if (publishedMode) {
          currentMode = publishedMode;
          sessionStorage.setItem(key, publishedMode);
          setSetupMode(publishedMode);
        }
      }

      if (!currentMode) {
        // Show choice popup
        const result = await Swal.fire({
          title: "Cấu hình sơ đồ sự kiện",
          text: "Bạn có cần sơ đồ khu vực hoặc ghế cho sự kiện này không?",
          icon: "question",
          showDenyButton: true,
          confirmButtonText: "Dùng sơ đồ",
          denyButtonText: "Không dùng sơ đồ",
          confirmButtonColor: "#2dc275",
          denyButtonColor: "#64748b",
          heightAuto: false,
        });

        if (result.isConfirmed) {
          currentMode = "SEAT_MAP";
          sessionStorage.setItem(key, "SEAT_MAP");
          setSetupMode("SEAT_MAP");
          toast.success("Đã chọn chế độ: Dùng sơ đồ");
        } else if (result.isDenied) {
          currentMode = "QUANTITY";
          sessionStorage.setItem(key, "QUANTITY");
          setSetupMode("QUANTITY");
          toast.success("Đã chọn chế độ: Không dùng sơ đồ");
        } else {
          return;
        }
      }
      navigate(`/organizer/events/${eventId}/media`);
    } else if (currentStepIndex === 1) {
      // Step 2: Media -> check setupMode
      const key = `organizer-ticket-setup-mode:${eventId}`;
      let currentMode = sessionStorage.getItem(key);

      if (!currentMode) {
        const publishedMode = await resolvePublishedSetupMode();
        if (publishedMode) {
          currentMode = publishedMode;
          sessionStorage.setItem(key, publishedMode);
          setSetupMode(publishedMode);
        }
      }

      if (!currentMode) {
        // Show choice popup fallback
        const result = await Swal.fire({
          title: "Cấu hình sơ đồ sự kiện",
          text: "Bạn có cần sơ đồ khu vực hoặc ghế cho sự kiện này không?",
          icon: "question",
          showDenyButton: true,
          confirmButtonText: "Dùng sơ đồ",
          denyButtonText: "Không dùng sơ đồ",
          confirmButtonColor: "#2dc275",
          denyButtonColor: "#64748b",
          heightAuto: false,
        });

        if (result.isConfirmed) {
          currentMode = "SEAT_MAP";
          sessionStorage.setItem(key, "SEAT_MAP");
          setSetupMode("SEAT_MAP");
          toast.success("Đã chọn chế độ: Dùng sơ đồ");
          navigate(`/organizer/events/${eventId}/layout`);
        } else if (result.isDenied) {
          currentMode = "QUANTITY";
          sessionStorage.setItem(key, "QUANTITY");
          setSetupMode("QUANTITY");
          toast.success("Đã chọn chế độ: Không dùng sơ đồ");
          navigate(`/organizer/events/${eventId}/ticket-types`);
        }
      } else {
        if (currentMode === "SEAT_MAP") {
          navigate(`/organizer/events/${eventId}/layout`);
        } else {
          navigate(`/organizer/events/${eventId}/ticket-types`);
        }
      }
    } else if (currentStepIndex === 2 && setupMode === "SEAT_MAP") {
      // Layout -> Seat Map
      navigate(`/organizer/events/${eventId}/seat-map`);
    } else if (currentStepIndex === 3 && setupMode === "SEAT_MAP") {
      // Seat Map -> Ticket Types
      navigate(`/organizer/events/${eventId}/ticket-types`);
    } else if (isQuantityTicketTypesStep) {
      await handlePublishEvent();
    } else if (isSeatMapTicketTypesStep && seatMapPublished) {
      await handlePublishEvent();
    } else if (isSeatMapTicketTypesStep) {
      navigate(`/organizer/events/${eventId}/seat-map`);
    } else if (currentStepIndex === steps.length - 1) {
      // Last step -> Finish
      toast.success("Thiết lập sự kiện đã hoàn tất!");
    }
  };

  const handleStepClick = (index: number) => {
    // Prevent navigating to layout/seat map if not chosen or disabled
    if (index > currentStepIndex) {
      if (!openedStepPaths.includes(steps[index].path)) return;
    }
    // Prevent clicking the current step
    if (index === currentStepIndex) {
      return;
    }
    if (!eventId) return;
    if (index > 0 && !openedStepPaths.includes(steps[index].path)) return;
    navigate(steps[index].path);
  };

  return (
    <nav className="organizer-workflow-nav" aria-label="Event workflow progress">
      <div className="organizer-workflow-steps">
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isOpened = isActive || openedStepPaths.includes(step.path);
          const isCompleted = index < currentStepIndex && currentStepIndex !== -1;
          const isDisabled = !eventId
            ? index > 0
            : index > 0 && !openedStepPaths.includes(step.path);

          return (
            <div key={step.label} style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
              {index > 0 && (
                <div
                  className="organizer-workflow-connector"
                  aria-hidden="true"
                  style={{ alignSelf: "center" }}
                />
              )}
              <button
                type="button"
                className={`organizer-workflow-step ${isActive ? "is-active" : ""} ${
                  isCompleted ? "is-completed" : ""
                } ${isOpened ? "is-opened" : ""} ${isDisabled ? "is-disabled" : ""}`}
                onClick={() => handleStepClick(index)}
                disabled={isDisabled || isActive}
              >
                <span className="organizer-workflow-step-num">{index + 1}</span>
                <span>{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="organizer-workflow-actions">
        <button
          type="button"
          onClick={handleSave}
          className="organizer-workflow-btn organizer-workflow-btn-save"
          disabled={savingSeatMap}
        >
          {saveButtonLabel}
        </button>
        {shouldShowContinueButton ? (
          <button
            type="button"
            onClick={handleContinue}
            className="organizer-workflow-btn organizer-workflow-btn-continue"
            disabled={publishingEvent || !hasSavedCurrentStep}
          >
            {isSeatMapTicketTypesStep
              ? seatMapPublished
                ? publishingEvent
                  ? "Đang publish"
                  : "Publish"
                : "Quay lại sơ đồ ghế"
              : isQuantityTicketTypesStep
                ? publishingEvent
                  ? "Đang publish"
                  : "Publish"
              : currentStepIndex === steps.length - 1
                ? "Hoàn tất"
                : "Tiếp tục"}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
