import '@fontsource/patrick-hand'
import '@fontsource/permanent-marker'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

const root = document.getElementById('root')
if (!root)
  throw new Error(
    'main: the #root element is missing, so the game cannot start'
  )

// Dev only: `?spike` opens the real-phone spike recorder instead of the game.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('spike')) {
  void import('./ui/SpikeRecorder').then(({ SpikeRecorder }) =>
    createRoot(root).render(
      <StrictMode>
        <SpikeRecorder />
      </StrictMode>
    )
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
