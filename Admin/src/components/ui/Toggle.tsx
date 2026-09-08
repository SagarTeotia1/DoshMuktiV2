'use client';

// Simple controlled switch — no dedicated toggle existed anywhere in Admin yet, every
// boolean field before this (isActive, etc.) was managed via a button-pair or checkbox
// input instead. Kept generic/unstyled-by-context so it's reusable outside offers/coupons.
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="block text-[11px] text-slate-400 mt-0.5">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors disabled:opacity-40 ${
          checked ? 'bg-[#9C5A26]' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
