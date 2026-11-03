/** @type {import('tailwindcss').Config} */

// Design tokens (PandiO/knk-workspace#95): every colour below reads a CSS variable from
// src/theme/tokens.css, so a theme switch (data-theme on <html>) restyles the app without a rebuild.
// `<alpha-value>` keeps the opacity modifiers working (`bg-primary/10`, `bg-white/95`, `bg-opacity-50`).
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ramp = (name) => Object.fromEntries(STEPS.map((step) => [step, v(`${name}-${step}`)]));
// danger/success/warning/info: DEFAULT (text, icons, filled), strong (text on the tints), soft (alert
// background), muted (badge background), line (alert border), fg (text on the filled colour).
const status = (name) => ({
  DEFAULT: v(`color-${name}`),
  strong: v(`color-${name}-strong`),
  soft: v(`color-${name}-soft`),
  muted: v(`color-${name}-muted`),
  line: v(`color-${name}-line`),
  ...(name === 'info' ? {} : { fg: v(`color-${name}-fg`) }),
});

const primaryOn = (use) => ({
  DEFAULT: v(`color-primary-${use}`),
  dark: v('color-primary-text-dark'),
  light: v('color-primary-light'),
  fg: v('color-primary-fg'),
});

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // The neutral ramps follow the theme (Tailwind's own values in `current`).
        gray: ramp('gray'),
        slate: ramp('slate'),
        // The key `primary` stays, so its ~580 uses switch with no component edit (report §11.3).
        primary: {
          DEFAULT: v('color-primary'),
          // Icons and accents only: white text on it fails AA in `current` (blue-500).
          light: v('color-primary-light'),
          // Hover/pressed shade of the primary buttons and links (#38).
          dark: v('color-primary-dark'),
          fg: v('color-primary-fg'),
        },
        cta: { DEFAULT: v('color-cta'), dark: v('color-cta-dark'), fg: v('color-cta-fg') },
        canvas: v('color-canvas'),
        surface: {
          DEFAULT: v('color-surface'),
          alt: v('color-surface-alt'),
          hover: v('slate-50'),
        },
        fg: v('color-fg'),
        muted: v('color-muted'),
        line: v('color-line'),
        field: v('color-field'),
        focus: v('color-focus'),
        backdrop: { DEFAULT: v('color-backdrop'), fg: v('color-backdrop-fg') },
        nav: {
          DEFAULT: v('color-nav'),
          fg: v('color-nav-fg'),
          muted: v('color-nav-muted'),
          hover: v('color-nav-hover'),
          line: v('color-nav-line'),
          accent: v('color-nav-accent'),
          focus: v('color-nav-focus'),
        },
        danger: status('danger'),
        success: status('success'),
        warning: status('warning'),
        info: status('info'),
        secondary: v('slate-500'),
        accent: v('slate-900'),
      },
      // `primary` as text, border or ring reads its own tokens: in `brand` the fill is orange, too light for
      // text on white, so text-primary is a darker orange (#95, 2026-11-03). Same values in the other themes.
      textColor: { primary: primaryOn('text') },
      borderColor: { primary: primaryOn('line') },
      ringColor: { primary: primaryOn('line') },
      divideColor: { primary: primaryOn('line') },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
    },
  },
  plugins: [],
};
