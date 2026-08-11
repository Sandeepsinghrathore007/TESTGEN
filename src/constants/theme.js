/**
 * theme.js — Design system tokens and app theme presets for Learnledger.
 *
 * The exported visual tokens below intentionally point at CSS variables so
 * existing inline styles can react to runtime theme switches without each
 * component needing its own refactor.
 */

export const THEME_STORAGE_KEY = 'learnledger-theme'
export const DEFAULT_THEME_ID = 'minimal-dark'

export const APP_THEME_OPTIONS = [
  {
    id: 'minimal-dark',
    label: 'Minimal Dark',
    shortLabel: 'Minimal',
    description: 'Linear-style focus mode',
  },
]

export const APP_THEMES = {
  'minimal-dark': {
    id: 'minimal-dark',
    tokens: {
      'page-background': '#0A0A0A',
      bg: '#0A0A0A',
      surface: '#111111',
      'surface-2': '#161616',
      border: '#1F2937',
      'border-strong': '#374151',
      'text-1': '#F9FAFB',
      'text-2': '#D1D5DB',
      'text-3': '#9CA3AF',
      accent: '#6366F1',
      'accent-2': '#4F46E5',
      secondary: '#818CF8',
      'accent-soft': 'rgba(99,102,241,0.12)',
      'accent-soft-strong': 'rgba(99,102,241,0.18)',
      'accent-border': 'rgba(99,102,241,0.32)',
      'topbar-bg': 'rgba(10,10,10,0.92)',
      'control-bg': 'rgba(255,255,255,0.03)',
      'control-border': 'rgba(31,41,55,0.9)',
      'button-gradient': 'linear-gradient(135deg, #6366F1, #4F46E5)',
      'selection-bg': 'rgba(99,102,241,0.32)',
      'shadow-soft': '0 10px 20px rgba(0,0,0,0.14)',
    },
  },
}

export function getAppTheme(themeId = DEFAULT_THEME_ID) {
  return APP_THEMES[themeId] || APP_THEMES[DEFAULT_THEME_ID]
}

export function readStoredAppThemeId() {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID

  const storedThemeId = window.localStorage.getItem(THEME_STORAGE_KEY)
  return APP_THEMES[storedThemeId] ? storedThemeId : DEFAULT_THEME_ID
}

export function applyAppTheme(themeId = DEFAULT_THEME_ID) {
  const theme = getAppTheme(themeId)

  if (typeof document === 'undefined') {
    return theme
  }

  const root = document.documentElement
  root.dataset.appTheme = theme.id

  Object.entries(theme.tokens).forEach(([token, value]) => {
    root.style.setProperty(`--ll-${token}`, value)
  })

  return theme
}

// ── BACKGROUND & SURFACE ──────────────────────────────────────────────────────
export const BG = 'var(--ll-bg)'
export const SURFACE = 'var(--ll-surface)'
export const SURF2 = 'var(--ll-surface-2)'

// ── BORDER ────────────────────────────────────────────────────────────────────
export const BORDER = 'var(--ll-border)'
export const BORDER2 = 'var(--ll-border-strong)'

// ── TEXT ──────────────────────────────────────────────────────────────────────
export const TEXT1 = 'var(--ll-text-1)'
export const TEXT2 = 'var(--ll-text-2)'
export const TEXT3 = 'var(--ll-text-3)'

// ── ACCENT ────────────────────────────────────────────────────────────────────
export const ACCENT = 'var(--ll-accent)'
export const ACCENT2 = 'var(--ll-accent-2)'
export const SECONDARY = 'var(--ll-secondary)'
export const ACCENT_SOFT = 'var(--ll-accent-soft)'
export const ACCENT_SOFT_STRONG = 'var(--ll-accent-soft-strong)'
export const ACCENT_BORDER = 'var(--ll-accent-border)'
export const TOPBAR_BG = 'var(--ll-topbar-bg)'
export const CONTROL_BG = 'var(--ll-control-bg)'
export const CONTROL_BORDER = 'var(--ll-control-border)'
export const BUTTON_GRADIENT = 'var(--ll-button-gradient)'
export const SHADOW_SOFT = 'var(--ll-shadow-soft)'

// ── SUBJECT PALETTE (12 accent colours for subject cards) ────────────────────
export const SUBJECT_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#10b981', '#84cc16', '#f59e0b', '#ef4444',
  '#f472b6', '#f97316', '#a855f7', '#14b8a6',
]

// ── SUBJECT ICONS (30 emoji/symbol options) ───────────────────────────────────
export const SUBJECT_ICONS = [
  { v: '∑', l: 'Sigma' }, { v: '⚛', l: 'Atom' },
  { v: '⚗', l: 'Flask' }, { v: '🧬', l: 'DNA' },
  { v: '🔭', l: 'Telescope' }, { v: '🧪', l: 'Test Tube' },
  { v: '📐', l: 'Ruler' }, { v: '∞', l: 'Infinity' },
  { v: 'π', l: 'Pi' }, { v: 'Δ', l: 'Delta' },
  { v: 'Ω', l: 'Omega' }, { v: '</>', l: 'Code' },
  { v: '💻', l: 'Laptop' }, { v: '🤖', l: 'AI' },
  { v: '📖', l: 'Book' }, { v: '✍', l: 'Write' },
  { v: '🗺', l: 'Map' }, { v: '🏛', l: 'Architecture' },
  { v: '⚖', l: 'Law' }, { v: '🎵', l: 'Music' },
  { v: '🌍', l: 'Earth' }, { v: '💡', l: 'Idea' },
  { v: '🔬', l: 'Microscope' }, { v: '📊', l: 'Chart' },
  { v: '🧠', l: 'Brain' }, { v: '⚡', l: 'Electric' },
  { v: '🔥', l: 'Fire' }, { v: '🌊', l: 'Wave' },
  { v: '🎯', l: 'Target' }, { v: '🧩', l: 'Puzzle' },
]

// ── AI SCORE THRESHOLDS ───────────────────────────────────────────────────────
export const AI_SCORE_BANDS = [
  { min: 85, label: 'Excellent', color: '#10b981' },
  { min: 70, label: 'Good', color: '#f59e0b' },
  { min: 50, label: 'Fair', color: '#f97316' },
  { min: 0, label: 'Needs Work', color: '#ef4444' },
]
