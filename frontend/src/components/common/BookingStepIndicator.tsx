import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import "../../assets/css/booking-step-indicator.css";

export type BookingStepState = "active" | "completed" | "inactive";

export interface BookingStepItem {
  label: string;
  state: BookingStepState;
  value: string;
}

interface BookingStepIndicatorProps {
  currentStep?: 1 | 2 | 3;
  steps?: BookingStepItem[];
}

function buildSteps(
  currentStep: 1 | 2 | 3,
  labels: string[],
  successMark: string,
): BookingStepItem[] {
  return labels.map((label, idx) => {
    const stepNumber = (idx + 1) as 1 | 2 | 3;

    if (stepNumber < currentStep) {
      return { label, state: "completed", value: successMark };
    }

    if (stepNumber === currentStep) {
      return { label, state: "active", value: String(stepNumber) };
    }

    return { label, state: "inactive", value: String(stepNumber) };
  });
}

export default function BookingStepIndicator({
  currentStep = 1,
  steps,
}: BookingStepIndicatorProps) {
  const { t } = useTranslation();
  const resolvedSteps =
    steps ??
    buildSteps(
      currentStep,
      [t("booking.selectTickets"), t("booking.payment"), t("booking.result")],
      t("booking.successMark"),
    );

  return (
    <div className="booking-step-indicator" aria-label={t("booking.steps")}>
      {resolvedSteps.map((step, index) => (
        <Fragment key={`${step.value}-${step.label}`}>
          <div className={`booking-step-item ${step.state}`}>
            <span className="booking-step-number">{step.value}</span>
            <span>{step.label}</span>
          </div>
          {index < resolvedSteps.length - 1 && (
            <div className="booking-step-divider" />
          )}
        </Fragment>
      ))}
    </div>
  );
}
