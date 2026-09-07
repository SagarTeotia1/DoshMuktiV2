'use client';

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmDisabled,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  // Prevents a rapid double-click firing the confirmed action twice before the dialog
  // has a chance to close — matters most for side-effectful actions (refunds, Delhivery
  // calls) where a duplicate request isn't purely wasted, it hits a real external API.
  confirmDisabled?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
