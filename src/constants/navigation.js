/**
 * navigation.js — Sidebar navigation configuration.
 *
 * Each entry maps a page id to its display label and shared icon key.
 * The 'comingSoon' flag controls whether the page shows a placeholder.
 */

export const NAV_ITEMS = [
  {
    id: 'tests',
    label: 'Tests',
    icon: 'tests',
    iconColor: '#fb7185',
    iconBg: 'rgba(251,113,133,0.14)',
    iconBorder: 'rgba(251,113,133,0.28)',
    comingSoon: false,
  },
  {
    id: 'questionBank',
    label: 'Question Bank',
    icon: 'questionBank',
    iconColor: '#f59e0b',
    iconBg: 'rgba(245,158,11,0.16)',
    iconBorder: 'rgba(245,158,11,0.28)',
    comingSoon: false,
  },
]

export const PAGE_DESCRIPTIONS = {
  tests: 'Import and validate offline JSON tests',
  questionBank: 'Saved AI tests',
}

