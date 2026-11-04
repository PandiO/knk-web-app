import React, { useEffect, useRef, useState } from 'react';
import { Check, Cog } from 'lucide-react';
import { THEMES, selectTheme, useActiveTheme } from './themes';

/**
 * The theme switcher: a cogwheel button with a menu of the themes (#95, developer request 2026-11-04).
 * Always visible, also logged out, so every visitor can try the themes: in the navigation bar when logged
 * in (`variant="nav"`), and as a small floating button in the top-right corner of the public pages when
 * logged out (`variant="floating"`, mounted in App.tsx). Switching is instant and the menu stays open, so
 * the themes can be flipped through. WAI-ARIA menu button: Enter/Space/ArrowDown open it on the selected
 * theme, arrows/Home/End move, Escape closes (focus back on the button), Tab or an outside click closes.
 */
type Props = { variant: 'nav' | 'floating' };

const BUTTON_CLASS: Record<Props['variant'], string> = {
  nav: 'inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-nav-muted bg-nav hover:bg-nav-hover hover:text-nav-fg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-nav focus:ring-nav-focus transition-colors',
  floating: 'inline-flex items-center p-2 rounded-full border border-line bg-surface/90 text-fg shadow-md backdrop-blur hover:bg-surface focus:outline-none focus:ring-2 focus:ring-focus transition-colors',
};

// On a phone the nav's cogwheel is not at the window edge, so its menu spans the window below the bar
// instead of hanging off the left side; from `sm` up it hangs under the button.
const MENU_POSITION: Record<Props['variant'], string> = {
  nav: 'fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72',
  floating: 'absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)]',
};

export function ThemeSwitcher({ variant }: Props) {
  const [open, setOpen] = useState(false);
  const activeTheme = useActiveTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Opening moves focus to the selected theme.
  useEffect(() => {
    if (!open) return;
    const selected = THEMES.findIndex(theme => theme.id === activeTheme);
    itemRefs.current[Math.max(selected, 0)]?.focus();
    // Only on opening: switching themes keeps the focus where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => !!item);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (e.key) {
      case 'Escape': e.preventDefault(); close(true); break;
      case 'ArrowDown': e.preventDefault(); focusAt(index + 1); break;
      case 'ArrowUp': e.preventDefault(); focusAt(index - 1); break;
      case 'Home': e.preventDefault(); focusAt(0); break;
      case 'End': e.preventDefault(); focusAt(items.length - 1); break;
      case 'Tab': setOpen(false); break;
    }
  };

  const menuId = `theme-menu-${variant}`;
  const buttonId = `theme-button-${variant}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        onClick={() => setOpen(value => !value)}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Theme"
        title="Theme"
        className={BUTTON_CLASS[variant]}
      >
        <Cog className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          onKeyDown={onMenuKeyDown}
          className={`z-50 rounded-md bg-surface py-1 shadow-lg ring-1 ring-black ring-opacity-5 ${MENU_POSITION[variant]}`}
        >
          <div className="px-4 pt-1 pb-1 text-xs font-medium text-muted" role="none">
            Theme
          </div>
          {THEMES.map((theme, index) => (
            <button
              key={theme.id}
              ref={el => { itemRefs.current[index] = el; }}
              type="button"
              role="menuitemradio"
              aria-checked={activeTheme === theme.id}
              tabIndex={-1}
              onClick={() => selectTheme(theme.id)}
              className="flex w-full items-start px-4 py-2 text-left text-sm text-fg hover:bg-surface-alt focus:bg-canvas focus:outline-none"
            >
              <Check className={`mr-3 mt-0.5 h-4 w-4 flex-shrink-0 ${activeTheme === theme.id ? '' : 'invisible'}`} aria-hidden="true" />
              <span>
                <span className="block font-medium">{theme.label}</span>
                <span className="block text-xs text-muted">{theme.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
