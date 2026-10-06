import React from 'react';

/**
 * Preview of Minecraft legacy-formatted text as the plugin renders it (DisplayTextFormatter):
 * {@code &}-codes for colours (several per line) and styles, hex as {@code &x&r&r&g&g&b&b}, line breaks
 * kept. Moved out of GameSettingsPage and extended with hex (KNG-52).
 */

type LegacyStyleState = {
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
};

export type LegacySegment = {
    text: string;
    style: LegacyStyleState;
};

const LEGACY_SECTION_CHAR = '§';
const LEGACY_ALT_CHAR = '&';
const LEGACY_TRANSLATABLE_CODES = '0123456789AaBbCcDdEeFfKkLlMmNnOoRrXx';
const HEX_DIGIT = /^[0-9a-f]$/;

const LEGACY_COLOR_MAP: Record<string, string> = {
    '0': '#000000',
    '1': '#0000AA',
    '2': '#00AA00',
    '3': '#00AAAA',
    '4': '#AA0000',
    '5': '#AA00AA',
    '6': '#FFAA00',
    '7': '#AAAAAA',
    '8': '#555555',
    '9': '#5555FF',
    a: '#55FF55',
    b: '#55FFFF',
    c: '#FF5555',
    d: '#FF55FF',
    e: '#FFFF55',
    f: '#FFFFFF',
};

const translateAlternateColorCodes = (altColorChar: string, textToTranslate: string): string => {
    if (!textToTranslate) {
        return '';
    }

    const chars = textToTranslate.split('');
    for (let i = 0; i < chars.length - 1; i++) {
        if (chars[i] === altColorChar && LEGACY_TRANSLATABLE_CODES.indexOf(chars[i + 1]) > -1) {
            chars[i] = LEGACY_SECTION_CHAR;
            chars[i + 1] = chars[i + 1].toLowerCase();
        }
    }
    return chars.join('');
};

const toStyle = (state: LegacyStyleState): React.CSSProperties => ({
    color: state.color,
    fontWeight: state.bold ? 700 : undefined,
    fontStyle: state.italic ? 'italic' : undefined,
    textDecoration: [
        state.underline ? 'underline' : '',
        state.strikethrough ? 'line-through' : '',
    ]
        .filter(Boolean)
        .join(' ') || undefined,
});

/** §x§r§r§g§g§b§b at {@code i} → "#rrggbb", else null. */
const readHex = (input: string, i: number): string | null => {
    if (input.length < i + 14) {
        return null;
    }
    let hex = '';
    for (let k = 0; k < 6; k++) {
        const marker = input.charAt(i + 2 + k * 2);
        const digit = input.charAt(i + 3 + k * 2).toLowerCase();
        if (marker !== LEGACY_SECTION_CHAR || !HEX_DIGIT.test(digit)) {
            return null;
        }
        hex += digit;
    }
    return `#${hex.toUpperCase()}`;
};

export const deserializeLegacyText = (input: string): LegacySegment[] => {
    if (!input) {
        return [];
    }

    const segments: LegacySegment[] = [];
    let state: LegacyStyleState = {};
    let currentText = '';

    const flush = () => {
        if (!currentText) {
            return;
        }
        segments.push({ text: currentText, style: { ...state } });
        currentText = '';
    };

    for (let i = 0; i < input.length; i++) {
        if (input.charAt(i) === LEGACY_SECTION_CHAR && i + 1 < input.length) {
            const code = input.charAt(i + 1).toLowerCase();

            if (code === 'x') {
                const hex = readHex(input, i);
                if (hex) {
                    flush();
                    state = { color: hex };
                    i += 13;
                    continue;
                }
            }

            if (code in LEGACY_COLOR_MAP) {
                flush();
                state = { color: LEGACY_COLOR_MAP[code] };
                i++;
                continue;
            }

            const style: Record<string, keyof LegacyStyleState> = { l: 'bold', m: 'strikethrough', n: 'underline', o: 'italic' };
            if (code in style) {
                flush();
                state = { ...state, [style[code]]: true };
                i++;
                continue;
            }

            if (code === 'r') {
                flush();
                state = {};
                i++;
                continue;
            }
        }

        currentText += input.charAt(i);
    }

    flush();
    return segments;
};

export const MinecraftLegacyPreview: React.FC<{ text: string; dark?: boolean }> = ({ text, dark }) => {
    const translated = translateAlternateColorCodes(LEGACY_ALT_CHAR, text);
    const segments = deserializeLegacyText(translated);
    const base = `text-sm whitespace-pre-wrap ${dark ? 'bg-gray-800 text-gray-100 rounded px-2 py-1 font-mono' : ''}`;

    if (segments.length === 0) {
        return <p className={`${base} ${dark ? '' : 'text-gray-700'}`}>{text || ' '}</p>;
    }

    return (
        <p className={base}>
            {segments.map((segment, index) => (
                <span key={`${segment.text}-${index}`} style={toStyle(segment.style)}>
                    {segment.text}
                </span>
            ))}
        </p>
    );
};
