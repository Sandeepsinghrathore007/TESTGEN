import { memo } from 'react'
import { NAV_ITEMS } from '@/constants/navigation'
import { ACCENT, BG, BORDER, BORDER2, BUTTON_GRADIENT, CONTROL_BG, SURF2, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import {
  AnalyticsIcon,
  BackIcon,
  MockTestsIcon,
  NoteIcon,
  QuestionBankIcon,
  SubjectsIcon,
} from '@/components/ui/Icons'

const NAV_ICONS = {
  subjects: SubjectsIcon,
  notes: NoteIcon,
  tests: MockTestsIcon,
  questionBank: QuestionBankIcon,
  analytics: AnalyticsIcon,
}

const DESKTOP_SIDEBAR_WIDTH = 228
const DESKTOP_COLLAPSED_WIDTH = 68

function Sidebar({
  collapsed,
  setCollapsed,
  activePage,
  setActivePage,
  isMobile = false,
  mobileOpen = false,
  ultraLite = false,
  setMobileOpen = () => {},
}) {
  const isCompact = isMobile ? false : collapsed
  const width = isMobile
    ? '250px'
    : isCompact
      ? `${DESKTOP_COLLAPSED_WIDTH}px`
      : `${DESKTOP_SIDEBAR_WIDTH}px`
  const transform = isMobile
    ? (mobileOpen ? 'translate3d(0,0,0)' : 'translate3d(calc(-100% - 14px),0,0)')
    : 'translate3d(0,0,0)'
  const itemTransition = ultraLite
    ? 'background 0.12s ease, color 0.12s ease'
    : 'background 0.16s ease, color 0.16s ease'

  return (
    <aside style={{
      width,
      flexShrink: 0,
      transition: ultraLite
        ? 'none'
        : isMobile
          ? 'transform 0.24s cubic-bezier(0.4,0,0.2,1)'
          : 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
      background: ultraLite ? 'rgba(6,11,20,0.98)' : BG,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 50,
      overflow: isMobile ? 'hidden' : 'visible',
      transform,
      boxShadow: 'none',
      willChange: isMobile ? 'transform' : 'width',
      backfaceVisibility: 'hidden',
      contain: 'layout paint size',
      pointerEvents: isMobile && !mobileOpen ? 'none' : 'auto',
    }}>
      <div style={{
        padding: '17px 13px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: `1px solid ${BORDER}`,
        minHeight: '62px',
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          flexShrink: 0,
          background: BUTTON_GRADIENT,
          borderRadius: '9px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '800',
          color: '#fff',
          boxShadow: 'var(--ll-shadow-soft)',
        }}>
          L
        </div>
        {!isCompact && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ color: TEXT1, fontWeight: '700', fontSize: '14.5px', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.3px' }}>
              Learnledger
            </div>
            <div style={{ color: TEXT3, fontSize: '10px', fontFamily: "'DM Sans',sans-serif" }}>
              Knowledge Hub
            </div>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '9px 6px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ id, label, icon, iconColor, iconBg, iconBorder }) => {
          const isActive = activePage === id
          const Icon = NAV_ICONS[icon] || NoteIcon
          return (
            <button
              key={id}
              onClick={() => {
                setActivePage(id)
                if (isMobile) setMobileOpen(false)
              }}
              title={isCompact ? label : ''}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '2px',
                borderRadius: '9px',
                padding: isCompact ? '10px 16px' : '9px 11px',
                background: isActive
                  ? 'var(--ll-accent-soft)'
                  : 'transparent',
                color: isActive ? ACCENT : TEXT3,
                border: 'none',
                justifyContent: isCompact ? 'center' : 'flex-start',
                transition: itemTransition,
                position: 'relative',
              }}
              onMouseEnter={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = 'var(--ll-accent-soft)'
                  event.currentTarget.style.color = TEXT2
                }
              }}
              onMouseLeave={(event) => {
                if (!isActive) {
                  event.currentTarget.style.background = 'transparent'
                  event.currentTarget.style.color = TEXT3
                }
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  height: '60%',
                  width: '3px',
                  background: ACCENT,
                  borderRadius: '0 4px 4px 0',
                }} />
              )}
              <span style={{
                width: '28px',
                height: '28px',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '9px',
                background: isActive
                  ? ultraLite
                    ? iconBg
                    : `linear-gradient(135deg,${iconBg},rgba(255,255,255,0.03))`
                  : iconBg,
                border: `1px solid ${iconBorder}`,
                color: iconColor,
                boxShadow: isMobile || !isActive ? 'none' : `0 10px 24px ${iconBg}`,
              }}>
                <span style={{ width: '15px', height: '15px', display: 'inline-flex' }}>
                  <Icon />
                </span>
              </span>
              {!isCompact && (
                <span style={{
                  fontSize: '13px',
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: isActive ? '600' : '500',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '9px 6px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{
          color: TEXT3,
          fontSize: '10px',
          fontFamily: "'DM Sans',sans-serif",
          letterSpacing: '0.2px',
        }}>
          Local mode
        </div>
      </div>

      {!isMobile && (
        <button
          onClick={() => setCollapsed((value) => !value)}
          style={{
            position: 'absolute',
            top: '19px',
            right: '-11px',
            width: '22px',
            height: '22px',
            background: SURF2,
            border: `1px solid ${BORDER2}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT2,
            zIndex: 10,
            transition: 'background 0.2s ease, color 0.2s ease',
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = CONTROL_BG)}
          onMouseLeave={(event) => (event.currentTarget.style.background = SURF2)}
        >
          <span style={{
            width: '10px',
            height: '10px',
            display: 'block',
            transform: isCompact ? 'rotate(0)' : 'rotate(180deg)',
            transition: 'transform 0.3s',
          }}>
            <BackIcon />
          </span>
        </button>
      )}
    </aside>
  )
}

export default memo(Sidebar)
