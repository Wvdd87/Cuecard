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
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="h">{title}</div>
        {body && <div className="b">{body}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="cf-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="cf-btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
