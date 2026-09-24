"use client";
import { dictionaries, languageNames } from "../lib/i18n";
import type { Language } from "../lib/types";

export function LanguagePicker({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <label className="language-picker">
      <span className="sr-only">{dictionaries[language].language}</span>
      <svg
        className="language-globe"
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
      <select
        className="language-select"
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
      >
        {Object.entries(languageNames).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <svg
        className="language-chevron"
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
