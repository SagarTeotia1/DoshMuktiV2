'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionSection {
  title: string;
  content: ReactNode;
}

export function Accordion({ sections, defaultOpenIndex = null }: { sections: AccordionSection[]; defaultOpenIndex?: number | null }) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  return (
    <div className="flex flex-col">
      {sections.map((section, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={section.title} className="border-b border-[#2B1B0C]/10">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between py-3 text-left font-body text-sm font-bold text-[#2B1B0C]"
              aria-expanded={isOpen}
            >
              {section.title}
              <ChevronDown
                size={14}
                strokeWidth={2.5}
                className={`text-[#9C5A26] transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && (
              <div className="font-body text-sm text-[#6B5539] leading-relaxed pb-3">{section.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
