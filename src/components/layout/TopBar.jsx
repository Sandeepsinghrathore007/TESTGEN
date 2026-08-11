/**
 * TopBar.jsx — Sticky header bar shown at the top of the main content area.
 *
 * Displays the current page title, today's date, the global theme switcher,
 * and optional install action.
 */

import { memo } from 'react'
import {
  BORDER,
  BUTTON_GRADIENT,
  CONTROL_BG,
  CONTROL_BORDER,
  TEXT1,
  TEXT2,
  TEXT3,
  TOPBAR_BG,
} from '@/constants/theme'

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '18px', height: '18px' }}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function InstallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '15px', height: '15px' }}
    >
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
    </svg>
  )
}

function ThemeSwitcher({
  activeThemeId,
  themeOptions,
  onThemeChange,
  compact = false,
}) {
  if (!themeOptions.length) return null

  if (compact) {
    return (
      <div style={{ minWidth: '112px', position: 'relative' }}>
        <select
          value={activeThemeId}
          onChange={(event) => onThemeChange(event.target.value)}
          aria-label="Select app theme"
          style={{
            width: '100%',
            height: '34px',
            borderRadius: '10px',
            border: `1px solid ${CONTROL_BORDER}`,
            background: CONTROL_BG,
            color: TEXT2,
            padding: '0 30px 0 10px',
            fontFamily: "'DM Sans',sans-serif",
            fontSize: '11.5px',
            fontWeight: '700',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            outline: 'none',
            backdropFilter: compact ? 'none' : 'blur(16px)',
          }}
        >
          {themeOptions.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: TEXT3,
            fontSize: '10px',
            pointerEvents: 'none',
          }}
        >
          v
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px',
        borderRadius: '12px',
        border: `1px solid ${CONTROL_BORDER}`,
        background: CONTROL_BG,
        backdropFilter: 'blur(18px)',
      }}
    >
      {themeOptions.map((theme) => {
        const isActive = theme.id === activeThemeId

        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onThemeChange(theme.id)}
            title={theme.description}
            aria-pressed={isActive}
            style={{
              minWidth: '72px',
              height: '30px',
              padding: '0 10px',
              borderRadius: '8px',
              border: 'none',
              background: isActive ? BUTTON_GRADIENT : 'transparent',
              color: isActive ? '#ffffff' : TEXT3,
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '11.5px',
              fontWeight: '800',
              letterSpacing: '-0.1px',
              cursor: 'pointer',
              transition: 'background 0.18s ease, color 0.18s ease, opacity 0.18s ease',
              opacity: isActive ? 1 : 0.92,
            }}
          >
            {theme.shortLabel || theme.label}
          </button>
        )
      })}
    </div>
  )
}

function TopBar({
  pageTitle,
  showMenuButton = false,
  ultraLite = false,
  onMenuClick = () => {},
  activeThemeId = '',
  themeOptions = [],
  onThemeChange = () => {},
  canInstall = false,
  onInstallClick = () => {},
  isInstallPending = false,
}) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const reduceEffects = showMenuButton || ultraLite

  return (
    <header
      className="px-4 sm:px-6 lg:px-7"
      style={{
        height: '58px',
        background: TOPBAR_BG,
        backdropFilter: reduceEffects ? 'none' : 'blur(20px)',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        contain: 'layout paint',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {showMenuButton && (
          <button
            type="button"
            className="lg:hidden"
            onClick={onMenuClick}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: `1px solid ${CONTROL_BORDER}`,
              background: CONTROL_BG,
              color: TEXT2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backdropFilter: reduceEffects ? 'none' : 'blur(16px)',
              willChange: 'transform',
            }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              color: TEXT1,
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: '700',
              fontSize: '16px',
              margin: 0,
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pageTitle}
          </h1>
          <p style={{ color: TEXT3, fontSize: '11px', margin: 0, fontFamily: "'DM Sans',sans-serif" }}>
            {today}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {canInstall && (
          <button
            type="button"
            onClick={onInstallClick}
            disabled={isInstallPending}
            style={{
              border: `1px solid ${CONTROL_BORDER}`,
              borderRadius: '10px',
              padding: '8px 12px',
              background: isInstallPending ? 'var(--ll-accent-soft)' : BUTTON_GRADIENT,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '-0.1px',
              opacity: isInstallPending ? 0.76 : 1,
            }}
            aria-label="Install LearnLedger app"
          >
            <InstallIcon />
            <span>{isInstallPending ? 'Opening...' : 'Install App'}</span>
          </button>
        )}
      </div>
    </header>
  )
}

export default memo(TopBar)
