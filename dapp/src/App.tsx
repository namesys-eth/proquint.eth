import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ConnectButton } from './components/utils/ConnectButton'
import { HomePage } from './components/home/HomePage'
import { RegisterForm } from './components/register/RegisterForm'
import { ProfileRouter } from './components/profile/ProfileRouter'
import { DocsPage } from './components/DocsPage'
import { ConfigModal } from './components/ConfigModal'
import { Footer } from './components/Footer'
import { EventIndexerProvider } from './hooks/EventIndexerContext'
import { IconButton } from './components/utils/IconButton'
import './App.css'

function HeaderActions({ onConfigOpen }: { onConfigOpen: () => void }) {
  return (
    <>
      <ConnectButton />
      <IconButton onClick={onConfigOpen} title="Settings" label="Settings">
        ⚙
      </IconButton>
    </>
  )
}

function AppContent() {
  const [navOpen, setNavOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path

  const handleNavClick = (path: string) => {
    setNavOpen(false)
    navigate(path)
  }

  const openConfig = () => { setNavOpen(false); setConfigOpen(true) }

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <h1>ProQuint.eth</h1>
          <button className="menu-toggle" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle navigation">
            ☰
          </button>
          <nav className={`header-tabs ${navOpen ? 'open' : ''}`}>
            {(
              [
                { path: '/', label: 'Home' },
                { path: '/register', label: 'Register' },
                { path: '/profile', label: 'Profile' },
              ] as const
            ).map(({ path, label }) => (
              <button
                key={path}
                className={isActive(path) ? 'active' : ''}
                onClick={() => handleNavClick(path)}
              >
                {label}
              </button>
            ))}
            <div className="mobile-connect">
              <HeaderActions onConfigOpen={openConfig} />
            </div>
          </nav>
          <div className="desktop-connect">
            <HeaderActions onConfigOpen={openConfig} />
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/profile" element={<ProfileRouter />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/:param" element={<ProfileRouter />} />
        </Routes>
      </main>
      
      <Footer />
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <EventIndexerProvider>
        <AppContent />
      </EventIndexerProvider>
    </BrowserRouter>
  )
}

export default App
