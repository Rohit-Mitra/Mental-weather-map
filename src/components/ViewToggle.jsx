/** Segmented control: this week's weather, or the year's climate. */
import React from 'react';

const OPTIONS = [
  { key: 'current', label: 'Current Conditions', hint: 'Latest week' },
  { key: 'outlook', label: '12-Month Outlook', hint: 'Yearly average' },
];

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="view-toggle" role="radiogroup" aria-label="Map view">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={value === opt.key}
          className={`view-toggle__btn ${value === opt.key ? 'is-active' : ''}`}
          onClick={() => onChange(opt.key)}
        >
          <span className="view-toggle__label">{opt.label}</span>
          <span className="view-toggle__hint">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}
