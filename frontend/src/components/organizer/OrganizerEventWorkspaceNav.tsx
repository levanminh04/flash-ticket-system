import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { GiTicket } from "react-icons/gi";
import { LuTicketsPlane } from "react-icons/lu";
import { organizerService } from "../../services/organizerService";
import { organizerWorkspaceService } from "../../services/organizerWorkspaceService";
import {
  ORGANIZER_WORKFLOW_DIRTY_EVENT,
  ORGANIZER_WORKFLOW_SAVE_RESULT_EVENT,
} from "../../pages/Organizer/organizerWorkflowEvents";

type OrganizerEventWorkspaceNavProps = {
  eventId?: string;
};

type Step = {
  label: string;
  path: string;
};

type TicketSetupMode = "SEAT_MAP" | "QUANTITY";

const isCurrentStep = (step: Step, pathname: string, search: string) => {
  const [stepPathname, stepSearch = ""] = step.path.split("?");
  return (
    pathname.toLowerCase().endsWith(stepPathname.toLowerCase()) &&
    (!stepSearch || search === `?${stepSearch}`)
  );
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
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [setupMode, setSetupMode] = useState<string | null>(null);
  const [openedStepPaths, setOpenedStepPaths] = useState<string[]>([]);
  const [publishingEvent, setPublishingEvent] = useState(false);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [hasSavedCurrentStep, setHasSavedCurrentStep] = useState(false);
  const [isCurrentStepDirty, setIsCurrentStepDirty] = useState(false);
  const [savingSeatMap, setSavingSeatMap] = useState(false);
  const [seatMapSaveElapsedSeconds, setSeatMapSaveElapsedSeconds] = useState(0);
  const [isCheckingContinuePrerequisite, setIsCheckingContinuePrerequisite] = useState(false);
  const [canContinueCurrentStep, setCanContinueCurrentStep] = useState(true);
  const [continueBlockedMessage, setContinueBlockedMessage] = useState<string | null>(null);
  const currentLocationKey = `${location.pathname}${location.search}`;
  const isPublishedEvent = eventStatus === "PUBLISHED";

  // Sync setup mode from sessionStorage
  useEffect(() => {
    if (!eventId) {
      setSetupMode(null);
      return;
    }
    const key = `organizer-ticket-setup-mode:${eventId}`;
    const stored = sessionStorage.getItem(key);
    setSetupMode(stored);
  }, [eventId, location.pathname]);

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
      sessionStorage.removeItem(getSavedWorkflowStepKey(currentLocationKey));
      setHasSavedCurrentStep(false);
      return;
    }

    setHasSavedCurrentStep(
      isPublishedEvent ||
        sessionStorage.getItem(getSavedWorkflowStepKey(currentLocationKey)) === "true",
    );
    setIsCurrentStepDirty(false);
  }, [currentLocationKey, eventId, isPublishedEvent]);

  useEffect(() => {
    const handleDirty = (event: Event) => {
      const detail = (event as CustomEvent<{ locationKey?: string; dirty?: boolean }>).detail;
      if (detail?.locationKey !== currentLocationKey) return;
      setIsCurrentStepDirty(Boolean(detail.dirty));
      if (detail.dirty && !isPublishedEvent) {
        setHasSavedCurrentStep(false);
        sessionStorage.removeItem(getSavedWorkflowStepKey(currentLocationKey));
      }
    };
    const handleSaveResult = (event: Event) => {
      const detail = (event as CustomEvent<{ locationKey?: string; success?: boolean }>).detail;
      if (detail?.locationKey !== currentLocationKey) return;
      const success = Boolean(detail.success);
      setHasSavedCurrentStep(success || isPublishedEvent);
      if (success) {
        setIsCurrentStepDirty(false);
        sessionStorage.setItem(getSavedWorkflowStepKey(currentLocationKey), "true");
      }
    };

    document.addEventListener(ORGANIZER_WORKFLOW_DIRTY_EVENT, handleDirty);
    document.addEventListener(ORGANIZER_WORKFLOW_SAVE_RESULT_EVENT, handleSaveResult);
    return () => {
      document.removeEventListener(ORGANIZER_WORKFLOW_DIRTY_EVENT, handleDirty);
      document.removeEventListener(ORGANIZER_WORKFLOW_SAVE_RESULT_EVENT, handleSaveResult);
    };
  }, [currentLocationKey, isPublishedEvent]);

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

  const eventPath = eventId ? `/organizer/events/${eventId}` : "";

  // Define steps dynamically based on selected setup mode
  const steps: Step[] = [
    {
      label: "workspaceNav.eventInfo",
      path: eventId ? `${eventPath}/edit` : "/organizer/events/new",
    },
    {
      label: "workspaceNav.eventImages",
      path: eventId ? `${eventPath}/media` : "",
    },
  ];

  if (setupMode === "SEAT_MAP" && eventId) {
    steps.push(
      { label: "workspaceNav.layout", path: `${eventPath}/layout` },
      { label: "workspaceNav.seatMap", path: `${eventPath}/seat-map?phase=sectors` },
    );
  }

  steps.push({
    label: "workspaceNav.ticketTypes",
    path: eventId ? `${eventPath}/ticket-types` : "",
  });

  if (setupMode === "SEAT_MAP" && eventId) {
    steps.push({
      label: "workspaceNav.finishSeatMap",
      path: `${eventPath}/seat-map?phase=assignment`,
    });
  }

  // Determine current active step
  const currentStepIndex = steps.findIndex((step) =>
    step.path && isCurrentStep(step, location.pathname, location.search)
  );
  const isSeatMapTicketTypesStep =
    setupMode === "SEAT_MAP" &&
    steps[currentStepIndex]?.label === "workspaceNav.ticketTypes" &&
    Boolean(eventId);
  const isSeatMapWorkflowStep =
    setupMode === "SEAT_MAP" &&
    (steps[currentStepIndex]?.label === "workspaceNav.seatMap" ||
      steps[currentStepIndex]?.label === "workspaceNav.finishSeatMap") &&
    Boolean(eventId);
  const isQuantityTicketTypesStep =
    setupMode === "QUANTITY" &&
    steps[currentStepIndex]?.label === "workspaceNav.ticketTypes" &&
    Boolean(eventId);
  const isFinalSeatMapStep = steps[currentStepIndex]?.label === "workspaceNav.finishSeatMap";
  const isLayoutStep = steps[currentStepIndex]?.label === "workspaceNav.layout";
  const isMediaStep = Boolean(eventId && steps[currentStepIndex]?.path === `${eventPath}/media`);

  const isUsableLayout = (layout: Awaited<ReturnType<typeof organizerWorkspaceService.getLayout>>) =>
    Boolean(
      layout?.backgroundImageUrl &&
        Number(layout.backgroundWidth ?? 0) > 0 &&
        Number(layout.backgroundHeight ?? 0) > 0,
    );

  const hasActiveSeatMapSectors = (seatMap: Awaited<ReturnType<typeof organizerWorkspaceService.getSeatMap>>) =>
    Boolean(seatMap?.sectors?.some((sector) => sector.isActive !== false));

  const hasActiveTicketTypes = async () => {
    if (!eventId) return false;
    const ticketTypes = await organizerWorkspaceService.getTicketTypes(eventId);
    return ticketTypes.some((ticketType) => {
      const status = String(ticketType.status ?? "").toUpperCase();
      return status !== "HIDDEN" && status !== "INACTIVE";
    });
  };

  const hasSeatMapImage = async () => {
    if (!eventId) return false;
    const images = await organizerService.getEventImages(eventId);
    return images.some(
      (image) =>
        image.imageType === "SEAT_MAP" &&
        image.isDeleted !== true &&
        Boolean(image.imageUrl),
    );
  };

  useEffect(() => {
    if (!eventId || isPublishedEvent) {
      setCanContinueCurrentStep(true);
      setContinueBlockedMessage(null);
      setIsCheckingContinuePrerequisite(false);
      return;
    }

    let cancelled = false;
    const currentLabel = steps[currentStepIndex]?.label;

    const resolvePrerequisite = async () => {
      if (setupMode !== "SEAT_MAP") {
        return { allowed: true, message: null };
      }

      if (isMediaStep) {
        const hasUploadedSeatMap = await hasSeatMapImage().catch(() => false);
        return hasUploadedSeatMap
          ? { allowed: true, message: null }
          : {
              allowed: false,
              message: t("workspaceNav.requireSeatMapImage"),
            };
      }

      if (currentLabel === "workspaceNav.layout") {
        const layout = await organizerWorkspaceService.getLayout(eventId).catch(() => null);
        return isUsableLayout(layout)
          ? { allowed: true, message: null }
          : {
              allowed: false,
              message: t("workspaceNav.requireValidLayout"),
            };
      }

      if (currentLabel === "workspaceNav.seatMap") {
        const seatMap = await organizerWorkspaceService.getSeatMap(eventId).catch(() => null);
        return hasActiveSeatMapSectors(seatMap)
          ? { allowed: true, message: null }
          : {
              allowed: false,
              message: t("workspaceNav.requireSector"),
            };
      }

      if (isSeatMapTicketTypesStep) {
        const [seatMap, hasTickets] = await Promise.all([
          organizerWorkspaceService.getSeatMap(eventId).catch(() => null),
          hasActiveTicketTypes().catch(() => false),
        ]);
        if (!hasActiveSeatMapSectors(seatMap)) {
          return {
            allowed: false,
            message: t("workspaceNav.requireSeatMapBeforeAssignment"),
          };
        }
        if (!hasTickets) {
          return {
            allowed: false,
            message: t("workspaceNav.requireTicketType"),
          };
        }
      }

      return { allowed: true, message: null };
    };

    setIsCheckingContinuePrerequisite(true);
    resolvePrerequisite()
      .then((result) => {
        if (cancelled) return;
        setCanContinueCurrentStep(result.allowed);
        setContinueBlockedMessage(result.message);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingContinuePrerequisite(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentStepIndex,
    eventId,
    hasSavedCurrentStep,
    isPublishedEvent,
    isMediaStep,
    isSeatMapTicketTypesStep,
    location.search,
    setupMode,
    t,
  ]);

  useEffect(() => {
    if (!eventId || !isPublishedEvent) return;

    const openedPaths = steps.map((step) => step.path).filter(Boolean);
    setOpenedStepPaths(openedPaths);
    sessionStorage.setItem(getOpenedWorkflowStepsKey(eventId), JSON.stringify(openedPaths));
  }, [eventId, isPublishedEvent, setupMode]);

  useEffect(() => {
    if (!eventId || !isPublishedEvent) return;

    let cancelled = false;
    Promise.all([
      organizerWorkspaceService.getSeatMap(eventId).catch(() => null),
      organizerWorkspaceService.getLayout(eventId).catch(() => null),
    ]).then(([seatMap, layout]) => {
      if (cancelled) return;
      const resolvedMode = seatMap || layout ? "SEAT_MAP" : "QUANTITY";
      sessionStorage.setItem(`organizer-ticket-setup-mode:${eventId}`, resolvedMode);
      setSetupMode(resolvedMode);
      if (seatMap) {
        sessionStorage.setItem(getSeatMapPublishedKey(eventId), "true");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, isPublishedEvent]);

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
      sessionStorage.removeItem(getSavedWorkflowStepKey(currentLocationKey));
      setHasSavedCurrentStep(false);
      return;
    }

  };

  const saveButtonLabel =
    isSeatMapWorkflowStep && savingSeatMap
      ? t("workspaceNav.savingWithTimer", { seconds: String(seatMapSaveElapsedSeconds).padStart(2, "0") })
      : isFinalSeatMapStep
        ? t("workspaceNav.saveToDatabase")
      : t("workspaceNav.save");

  const handlePublishEvent = async () => {
    if (!eventId || publishingEvent) return;

    setPublishingEvent(true);
    try {
      const nextEvent = await organizerWorkspaceService.publishEvent(eventId);
      setEventStatus(nextEvent.status || null);
      document.dispatchEvent(new CustomEvent("organizer-event-status-updated", { detail: nextEvent }));
      toast.success(t("workspaceNav.publishSuccess"));
      navigate("/organizer/events");
    } catch {
      toast.error(t("workspaceNav.publishFailed"));
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

  const chooseTicketSetupMode = async (): Promise<TicketSetupMode | null> => {
    const seatMapIcon = renderToStaticMarkup(<GiTicket aria-hidden="true" />);
    const quantityIcon = renderToStaticMarkup(<LuTicketsPlane aria-hidden="true" />);
    const result = await Swal.fire<TicketSetupMode>({
      title: t("workspaceNav.chooseSetupTitle"),
      html: `
        <p class="organizer-setup-mode-description">
          ${t("workspaceNav.chooseSetupDescription")}
        </p>
        <div class="organizer-setup-mode-grid" role="radiogroup" aria-label="${t("workspaceNav.chooseSetupAria")}">
          <button type="button" class="organizer-setup-mode-card is-selected" data-mode="SEAT_MAP" role="radio" aria-checked="true">
            <span class="organizer-setup-mode-icon" aria-hidden="true">${seatMapIcon}</span>
            <span class="organizer-setup-mode-content">
              <strong>${t("workspaceNav.modeSeatMap")}</strong>
              <small>${t("workspaceNav.modeSeatMapDescription")}</small>
            </span>
          </button>
          <button type="button" class="organizer-setup-mode-card" data-mode="QUANTITY" role="radio" aria-checked="false">
            <span class="organizer-setup-mode-icon" aria-hidden="true">${quantityIcon}</span>
            <span class="organizer-setup-mode-content">
              <strong>${t("workspaceNav.modeQuantity")}</strong>
              <small>${t("workspaceNav.modeQuantityDescription")}</small>
            </span>
          </button>
        </div>
      `,
      confirmButtonText: t("workspaceNav.continue"),
      showCancelButton: true,
      cancelButtonText: t("workspaceNav.later"),
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#64748b",
      customClass: {
        popup: "organizer-setup-mode-popup",
        htmlContainer: "organizer-setup-mode-html",
        actions: "organizer-setup-mode-actions",
      },
      heightAuto: false,
      didOpen: (popup) => {
        const cards = Array.from(
          popup.querySelectorAll<HTMLButtonElement>(".organizer-setup-mode-card"),
        );
        cards.forEach((card) => {
          card.addEventListener("click", () => {
            cards.forEach((item) => {
              const selected = item === card;
              item.classList.toggle("is-selected", selected);
              item.setAttribute("aria-checked", String(selected));
            });
          });
        });
      },
      preConfirm: () => {
        const selected = document.querySelector<HTMLButtonElement>(
          ".organizer-setup-mode-card.is-selected",
        );
        return (selected?.dataset.mode as TicketSetupMode | undefined) ?? "SEAT_MAP";
      },
    });

    return result.isConfirmed ? result.value ?? null : null;
  };

  const handleContinue = async () => {
    if (currentStepIndex === -1) return;
    if (!isPublishedEvent && !canContinueCurrentStep) {
      toast.info(continueBlockedMessage || t("workspaceNav.finishCurrentStep"));
      return;
    }

    if (!eventId) {
      toast.info(t("workspaceNav.createInfoRequired"));
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
        currentMode = await chooseTicketSetupMode();
        if (!currentMode) return;
        sessionStorage.setItem(key, currentMode);
        setSetupMode(currentMode);
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
        currentMode = await chooseTicketSetupMode();
        if (!currentMode) return;
        sessionStorage.setItem(key, currentMode);
        setSetupMode(currentMode);
        if (currentMode === "SEAT_MAP") {
          navigate(`/organizer/events/${eventId}/layout`);
        } else {
          navigate(`/organizer/events/${eventId}/ticket-types`);
        }
      } else {
        if (currentMode === "SEAT_MAP") {
          navigate(`/organizer/events/${eventId}/layout`);
        } else {
          navigate(`/organizer/events/${eventId}/ticket-types`);
        }
      }
    } else if (steps[currentStepIndex]?.label === "workspaceNav.layout") {
      navigate(`/organizer/events/${eventId}/seat-map?phase=sectors`);
    } else if (steps[currentStepIndex]?.label === "workspaceNav.seatMap") {
      navigate(`/organizer/events/${eventId}/ticket-types`);
    } else if (isSeatMapTicketTypesStep) {
      navigate(`/organizer/events/${eventId}/seat-map?phase=assignment`);
    } else if (steps[currentStepIndex]?.label === "workspaceNav.finishSeatMap") {
      navigate("/organizer/events");
    } else if (isQuantityTicketTypesStep) {
      await handlePublishEvent();
    }
  };

  const handleStepClick = (index: number) => {
    if (isPublishedEvent) {
      if (index !== currentStepIndex && eventId) navigate(steps[index].path);
      return;
    }
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
            : !isPublishedEvent && index > 0 && !openedStepPaths.includes(step.path);

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
                <span>{t(step.label)}</span>
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
          disabled={savingSeatMap || (!isFinalSeatMapStep && !isLayoutStep && !isCurrentStepDirty)}
        >
          {saveButtonLabel}
        </button>
        {!isFinalSeatMapStep ? (
          <button
            type="button"
            onClick={handleContinue}
            className="organizer-workflow-btn organizer-workflow-btn-continue"
            disabled={
              publishingEvent ||
              isCheckingContinuePrerequisite ||
              (!isPublishedEvent && (!hasSavedCurrentStep || !canContinueCurrentStep))
            }
          >
            {isQuantityTicketTypesStep
              ? publishingEvent
                ? t("workspaceNav.publishing")
                : "Publish"
              : t("workspaceNav.continue")}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
