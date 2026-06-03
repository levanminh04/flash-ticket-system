export const ORGANIZER_WORKFLOW_DIRTY_EVENT = "organizer-workflow-step-dirty";
export const ORGANIZER_WORKFLOW_SAVE_RESULT_EVENT = "organizer-workflow-step-save-result";

function getLocationKey() {
  return `${window.location.pathname}${window.location.search}`;
}

export function dispatchOrganizerWorkflowDirty(dirty = true) {
  const locationKey = getLocationKey();
  if (dirty) {
    sessionStorage.removeItem(`organizer-workflow-step-saved:${locationKey}`);
  }
  document.dispatchEvent(
    new CustomEvent(ORGANIZER_WORKFLOW_DIRTY_EVENT, {
      detail: { locationKey, dirty },
    }),
  );
}

export function dispatchOrganizerWorkflowSaveResult(success: boolean) {
  const locationKey = getLocationKey();
  if (success) {
    sessionStorage.setItem(`organizer-workflow-step-saved:${locationKey}`, "true");
  } else {
    sessionStorage.removeItem(`organizer-workflow-step-saved:${locationKey}`);
  }
  document.dispatchEvent(
    new CustomEvent(ORGANIZER_WORKFLOW_SAVE_RESULT_EVENT, {
      detail: { locationKey, success },
    }),
  );
}
