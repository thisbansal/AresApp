import { Routes, Route, Navigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { EdgeScrollTriggers } from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import UserSelectPage from './pages/UserSelectPage'

function App() {
  return (
    <WebOSInputProvider>
      <KeyboardHandler />
      <EdgeScrollTriggers />

      <div className="app">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/user-select" element={<UserSelectPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </WebOSInputProvider>
  )
}

export default App