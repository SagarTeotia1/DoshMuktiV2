'use client';

import { useState } from 'react';
import { toast } from 'sonner';

const inputClass = 'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewSectionForm({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (values: { key: string; title: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!keyTouched) setKey(slugify(value));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title is required');
    if (!key.trim()) return toast.error('Key is required');
    onSubmit({ key: key.trim(), title: title.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. Handpicked This Week"
          className={`${inputClass} w-full`}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Key <span className="font-normal text-slate-400">(lowercase, hyphens — used internally, not shown to customers)</span>
        </label>
        <input
          value={key}
          onChange={(e) => {
            setKeyTouched(true);
            setKey(e.target.value);
          }}
          placeholder="handpicked-this-week"
          className={`${inputClass} w-full`}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#6B3D19] transition-colors disabled:opacity-50 mt-2"
      >
        {submitting ? 'Creating...' : 'Create Section'}
      </button>
    </form>
  );
}
