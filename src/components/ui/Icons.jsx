/**
 * Icons.jsx — Inline SVG icon library for Learnledger.
 *
 * All icons are functional components that render inline SVG.
 * They inherit size from parent via width/height, and colour via currentColor.
 *
 * Usage:
 *   import { PlusIcon, TrashIcon } from '@/components/ui/Icons'
 *   <span style={{ width: 14, height: 14 }}><PlusIcon /></span>
 */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const PlusIcon = () => (
  <svg {...iconProps} strokeWidth="2.2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
)

export const XIcon = () => (
  <svg {...iconProps} strokeWidth="2.2">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
)

export const BackIcon = () => (
  <svg {...iconProps} strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const EditIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const TrashIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
)

export const ChevronDownIcon = () => (
  <svg {...iconProps} strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const SearchIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export const DownloadIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
)

export const FilterIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </svg>
)

export const ClockIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const SparklesIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="m12 3 1.6 3.9L17 8.5l-3.4 1.4L12 14l-1.6-4.1L7 8.5l3.4-1.6L12 3Z" />
    <path d="m19 14 .8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9Z" />
    <path d="m5 14 .6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5Z" />
  </svg>
)

export const NoteIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

export const PdfIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

export const BookmarkIcon = ({ filled = false }) => (
  <svg
    {...iconProps}
    fill={filled ? 'currentColor' : 'none'}
    strokeWidth="1.8"
  >
    <path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-3.8-6 3.8v-14a1 1 0 0 1 1-1Z" />
  </svg>
)

export const UploadIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
  </svg>
)

export const SaveIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

export const EyeIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const ExternalLinkIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M14 5h5v5" />
    <path d="M10 14 19 5" />
    <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
  </svg>
)

export const SubjectsIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v13.5A2.5 2.5 0 0 0 17.5 15H4z" />
    <path d="M6.5 20A2.5 2.5 0 0 1 4 17.5V6.5" />
    <path d="M8 8h8" />
    <path d="M8 11h8" />
  </svg>
)

export const TopicsIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M4 6.5h16" />
    <path d="M4 12h16" />
    <path d="M4 17.5h10" />
    <circle cx="18" cy="17.5" r="2.5" />
  </svg>
)

export const MockTestsIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M9 3h6" />
    <path d="M10 8h8" />
    <path d="M10 12h8" />
    <path d="M10 16h5" />
    <path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
    <path d="m6.5 11 1.5 1.5 3-3" />
  </svg>
)

export const QuestionBankIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14.5A2.5 2.5 0 0 0 16.5 15H5z" />
    <path d="M7.5 21A2.5 2.5 0 0 1 5 18.5V5.5" />
    <path d="M9 8h6" />
    <path d="M9 11.5h7" />
    <path d="m9.5 16 1.6 1.6 3.4-4" />
  </svg>
)

export const AIAssistantIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <rect x="5" y="7" width="14" height="10" rx="3" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M9.5 15c1 .8 4 .8 5 0" />
    <path d="M12 17v2" />
  </svg>
)

export const AnalyticsIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M4 19h16" />
    <path d="M7 16V9" />
    <path d="M12 16V5" />
    <path d="M17 16v-4" />
    <path d="m5 13 4-4 3 2 5-5" />
  </svg>
)

export const ConstructionIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M3 21h18" />
    <path d="m6 21 3-9" />
    <path d="m18 21-3-9" />
    <path d="M7 12h10" />
    <path d="m8 12 2-5h4l2 5" />
    <path d="M12 4V3" />
  </svg>
)

export const CopyIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...iconProps} strokeWidth="2.2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

