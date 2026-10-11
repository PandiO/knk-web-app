import React from 'react';
import { minecraftMaterialRefClient } from '../../../apiClients/minecraftMaterialRefClient';
import { MinecraftHybridMaterialOptionDto } from '../../../types/dtos/minecraftMaterialRef/MinecraftHybridMaterialOptionDto';
import { toMaterialKey } from './roadProfileForm';

// Plan D10 / R38: a profile material is a Bukkit Material name typed into a text field, with
// suggestions from the material catalogue (GET api/MinecraftMaterialRefs/hybrid) - the paged
// HybridMaterialPicker is too heavy for one table row. Picking a suggestion writes its key in
// Bukkit form (minecraft:stone_bricks -> STONE_BRICKS).

/** How many catalogue matches to offer per keystroke. */
export const MATERIAL_SUGGESTION_LIMIT = 8;
const SUGGESTION_DELAY_MS = 250;

export const MaterialKeyInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}> = ({ value, onChange, label, disabled }) => {
  const [suggestions, setSuggestions] = React.useState<MinecraftHybridMaterialOptionDto[]>([]);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (query === null || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      minecraftMaterialRefClient
        .getHybrid(query.trim(), undefined, MATERIAL_SUGGESTION_LIMIT)
        .then((options) => {
          if (!cancelled) setSuggestions(options ?? []);
        })
        .catch((err: unknown) => {
          // Suggestions are a convenience; typing the key still works.
          console.error('Failed to load material suggestions:', err);
          if (!cancelled) setSuggestions([]);
        });
    }, SUGGESTION_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = (option: MinecraftHybridMaterialOptionDto) => {
    onChange(toMaterialKey(option.namespaceKey));
    setQuery(null);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        className="border border-gray-300 rounded-md px-2 py-1 text-sm w-44 font-mono uppercase"
        value={value}
        aria-label={label}
        placeholder="COBBLESTONE"
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-64 bg-white shadow-lg rounded-md py-1 text-sm ring-1 ring-black ring-opacity-5 max-h-56 overflow-auto" role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((option) => {
            const key = toMaterialKey(option.namespaceKey);
            return (
              <li key={option.namespaceKey}>
                <button
                  type="button"
                  role="option"
                  aria-selected={key === value}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                >
                  <span className="font-mono">{key}</span>
                  {option.displayName && option.displayName !== key && <span className="ml-2 text-xs text-gray-500">{option.displayName}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
