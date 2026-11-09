import React from 'react';

export interface ProfileTab<K extends string> {
    key: K;
    label: string;
}

interface Props<K extends string> {
    tabs: ProfileTab<K>[];
    current: K;
    onChange: (key: K) => void;
    /** Prefix of the tab and panel ids. */
    idPrefix: string;
    label: string;
}

/** The id of a tab's panel, for `aria-controls` / `aria-labelledby`. */
export const tabPanelId = (idPrefix: string, key: string) => `${idPrefix}-panel-${key}`;
export const tabId = (idPrefix: string, key: string) => `${idPrefix}-tab-${key}`;

/**
 * #119 (MOD-4): the player profile's tabs, an ARIA tablist: one tab stop, Left/Right/Home/End move between tabs
 * (and open them). Scrolls sideways on its own at phone width instead of the page.
 */
export function ProfileTabs<K extends string>({ tabs, current, onChange, idPrefix, label }: Props<K>) {
    const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

    const move = (event: React.KeyboardEvent, index: number) => {
        let next = -1;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next < 0) return;
        event.preventDefault();
        onChange(tabs[next].key);
        refs.current[tabs[next].key]?.focus();
    };

    return (
        <div className="-mx-1 overflow-x-auto px-1">
            <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b border-line">
                {tabs.map((tab, index) => {
                    const selected = tab.key === current;
                    return (
                        <button
                            key={tab.key}
                            ref={el => { refs.current[tab.key] = el; }}
                            id={tabId(idPrefix, tab.key)}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={tabPanelId(idPrefix, tab.key)}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => onChange(tab.key)}
                            onKeyDown={event => move(event, index)}
                            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${selected
                                ? 'border-primary text-fg'
                                : 'border-transparent text-muted hover:text-fg'}`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
