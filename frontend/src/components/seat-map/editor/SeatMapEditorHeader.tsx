import { ArrowLeft, Eye, Send, Save } from "lucide-react";

interface SeatMapEditorHeaderProps {
  title?: string;
  publishing: boolean;
  publishLabel: string;
  canSave: boolean;
  canPublish: boolean;
  onBack: () => void;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export default function SeatMapEditorHeader({
  title,
  publishing,
  publishLabel,
  canSave,
  canPublish,
  onBack,
  onPreview,
  onSaveDraft,
  onPublish,
}: SeatMapEditorHeaderProps) {
  return (
    <header className="seat-map-editor-header">
      <div className="seat-map-editor-header-left">
        <button type="button" className="seat-map-editor-back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          Back to Events
        </button>
        <div>
          <h1>Seat Map Editor</h1>
          <p>{title ? `Create and manage seating layouts for ${title}` : "Create and manage seating layouts"}</p>
        </div>
      </div>

      <div className="seat-map-editor-header-actions">
        <button type="button" className="seat-map-editor-button secondary" onClick={onPreview}>
          <Eye size={16} />
          Preview
        </button>
        <button
          type="button"
          className="seat-map-editor-button soft"
          onClick={onSaveDraft}
          disabled={!canSave}
        >
          <Save size={16} />
          Save Draft
        </button>
        <button
          type="button"
          className="seat-map-editor-button primary"
          onClick={onPublish}
          disabled={!canPublish || publishing}
        >
          <Send size={16} />
          {publishLabel}
        </button>
      </div>
    </header>
  );
}
