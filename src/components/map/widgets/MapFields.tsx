import React from 'react';

/** A label/value list for the public panel fields (O32). Empty values are left out. */
export const MapFields: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({ rows }) => {
  const shown = rows.filter(row => row.value !== null && row.value !== undefined && row.value !== '');
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
      {shown.map(row => (
        <React.Fragment key={row.label}>
          <dt className="text-muted">{row.label}</dt>
          <dd className="text-fg">{row.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

export const MapDescription: React.FC<{ text: string | null | undefined }> = ({ text }) =>
  text && text.trim() ? <p className="whitespace-pre-line text-sm text-fg">{text}</p> : null;
