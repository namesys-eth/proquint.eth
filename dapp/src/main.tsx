import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.tsx'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { config } from './libs/wagmi.ts'
import { CustomAvatar } from './components/utils/CustomAvatar'
import { ThemeProvider, useThemeContext } from './hooks/ThemeContext'

const queryClient = new QueryClient()

function buildDarkTheme() {
  const t = darkTheme({
    accentColor: '#c8c8cc',
    accentColorForeground: '#111113',
    borderRadius: 'small',
    fontStack: 'system',
    overlayBlur: 'small',
  })
  t.colors.modalBackground = '#1e1e21'
  t.colors.modalBorder = '#2e2e33'
  t.colors.generalBorder = '#2e2e33'
  t.colors.actionButtonBorder = '#2e2e33'
  t.colors.actionButtonSecondaryBackground = '#24242a'
  t.colors.profileForeground = '#19191b'
  t.colors.closeButton = '#8b8b96'
  t.colors.closeButtonBackground = '#24242a'
  t.colors.connectButtonBackground = '#24242a'
  t.colors.connectButtonInnerBackground = '#1e1e21'
  t.colors.connectButtonText = '#e8e8ec'
  t.colors.modalText = '#e8e8ec'
  t.colors.modalTextSecondary = '#8b8b96'
  return t
}

function buildLightTheme() {
  const t = lightTheme({
    accentColor: '#4a4a50',
    accentColorForeground: '#ffffff',
    borderRadius: 'small',
    fontStack: 'system',
    overlayBlur: 'small',
  })
  t.colors.modalBackground = '#ffffff'
  t.colors.modalBorder = '#d1d1d6'
  t.colors.generalBorder = '#d1d1d6'
  t.colors.actionButtonBorder = '#d1d1d6'
  t.colors.actionButtonSecondaryBackground = '#ebebef'
  t.colors.profileForeground = '#f5f5f7'
  t.colors.closeButton = '#6e6e78'
  t.colors.closeButtonBackground = '#ebebef'
  t.colors.connectButtonBackground = '#ebebef'
  t.colors.connectButtonInnerBackground = '#ffffff'
  t.colors.connectButtonText = '#1a1a1e'
  t.colors.modalText = '#1a1a1e'
  t.colors.modalTextSecondary = '#6e6e78'
  return t
}

const rkDark = buildDarkTheme()
const rkLight = buildLightTheme()

function RainbowKitWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeContext()
  return (
    <RainbowKitProvider avatar={CustomAvatar} theme={theme === 'dark' ? rkDark : rkLight}>
      {children}
    </RainbowKitProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitWrapper>
            <App />
          </RainbowKitWrapper>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  </StrictMode>,
)
