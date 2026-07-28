export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="scrim" onClick={onCancel}>
      <div
        className="popover"
        style={{ width: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600 }}>{title}</div>
        {body && <div className="hint">{body}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
