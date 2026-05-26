import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

interface EditorAccordionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  action?: ReactNode;
}

export default function EditorAccordion({
  title,
  icon,
  defaultOpen = true,
  children,
  action,
}: EditorAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="seat-map-editor-accordion">
      <button
        type="button"
        className="seat-map-editor-accordion-header"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="seat-map-editor-accordion-title">
          {icon}
          <span>{title}</span>
        </span>
        <span className="seat-map-editor-accordion-actions">
          {action}
          <ChevronDown size={16} className={open ? "is-open" : ""} />
        </span>
      </button>
      {open ? <div className="seat-map-editor-accordion-body">{children}</div> : null}
    </section>
  );
}
