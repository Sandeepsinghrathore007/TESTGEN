/**
 * main.jsx — React application entry point.
 * Mounts the root <App /> component into #root.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { registerPWA } from './registerPWA'
import { applyAppTheme, readStoredAppThemeId } from '@/constants/theme'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import './styles/global.css'

registerPWA()
applyAppTheme(readStoredAppThemeId())

document.documentElement.classList.add('learnledger-square-ui')
document.body.classList.add('learnledger-square-ui')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

