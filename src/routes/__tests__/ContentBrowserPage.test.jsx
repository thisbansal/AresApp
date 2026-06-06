import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContentBrowserPage from '../ContentBrowserPage'
import { useServerManagerStore } from '../../stores/serverManagerStore'
import { useBrowserStore } from '../../stores/browserStore'
import { useServerStore } from '../../stores/serverStore'

// Mock styles and context to prevent syntax errors
vi.mock('../../contexts/SpatialNavigationContext', () => {
  const React = require('react');
  const LayerContext = React.createContext('base');
  return {
    useSpatialNavigation: () => ({
      registerNode: vi.fn(),
      unregisterNode: vi.fn(),
      setNavigationMode: vi.fn(),
      lastRemoteActionRef: { current: 0 },
      lastNavDirectionRef: { current: 'down' }
    }),
    SpatialNavigationProvider: ({ children }) => <div>{children}</div>,
    LayerContext,
    FocusLayer: ({ children }) => <div>{children}</div>
  };
})

vi.mock('../../stores/serverManagerStore', () => ({
  useServerManagerStore: {
    getState: vi.fn(() => ({
      servers: {
        '123': { uri: 'http://local', accessToken: 'token', owned: true, name: 'Main' }
      }
    }))
  }
}))

vi.mock('../../stores/serverStore', () => ({
  useServerStore: vi.fn()
}))

vi.mock('../../stores/browserStore', () => ({
  useBrowserStore: vi.fn()
}))

describe('ContentBrowserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useServerStore.mockImplementation((selector) => {
      if (selector) return selector({ isOnline: true })
      return { uri: 'http://local', token: 'token' }
    })
  })

  it('renders NavigationBar correctly with active tab', () => {
    useBrowserStore.mockImplementation((selector) => {
      const state = {
        activeTab: { type: 'home' },
        continueWatching: [],
        setContinueWatching: vi.fn(),
        recentMovies: [],
        setRecentMovies: vi.fn(),
        recentTv: [],
        setRecentTv: vi.fn(),
        libraryContent: { all: [] },
        setLibraryContent: vi.fn(),
        showUnwatchedIndicator: true,
        subtitleWeight: 400
      }
      return selector(state)
    })

    const { container } = render(
      <MemoryRouter>
        <ContentBrowserPage />
      </MemoryRouter>
    )

    expect(container.querySelector('.nav-scroll-container')).toBeInTheDocument()
    // By default, online, so offline message should not be there
    expect(screen.queryByText(/Plex Server Took a Nap/i)).not.toBeInTheDocument()
  })

  it('renders offline message and keeps navigation accessible when server is unreachable', () => {
    useServerStore.mockImplementation((selector) => {
      if (selector) return selector({ isOnline: false })
      return { uri: 'http://local', token: 'token' }
    })

    useBrowserStore.mockImplementation((selector) => {
      const state = {
        activeTab: { type: 'home' },
        continueWatching: [],
        setContinueWatching: vi.fn(),
        recentMovies: [],
        setRecentMovies: vi.fn(),
        recentTv: [],
        setRecentTv: vi.fn(),
        libraryContent: { all: [] },
        setLibraryContent: vi.fn(),
        showUnwatchedIndicator: true,
        subtitleWeight: 400
      }
      return selector(state)
    })

    const { container } = render(
      <MemoryRouter>
        <ContentBrowserPage />
      </MemoryRouter>
    )

    // Offline message should be displayed
    expect(screen.getByText(/Plex Server Took a Nap/i)).toBeInTheDocument()
    // Navigation bar MUST still be accessible
    expect(container.querySelector('.nav-scroll-container')).toBeInTheDocument()
  })
})
