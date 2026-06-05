import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContentBrowserPage from '../ContentBrowserPage'
import { useServerManagerStore } from '../../stores/serverManagerStore'
import { useBrowserStore } from '../../stores/browserStore'

// Mock styles and context to prevent syntax errors
vi.mock('../../contexts/SpatialNavigationContext', () => ({
  useSpatialNavigation: () => ({
    registerNode: vi.fn(),
    unregisterNode: vi.fn(),
    setNavigationMode: vi.fn(),
    lastRemoteActionRef: { current: 0 },
    lastNavDirectionRef: { current: 'down' }
  }),
  SpatialNavigationProvider: ({ children }) => <div>{children}</div>
}))

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
  useServerStore: () => ({ uri: 'http://local', token: 'token' })
}))

vi.mock('../../stores/browserStore', () => ({
  useBrowserStore: vi.fn()
}))

describe('ContentBrowserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders NavigationBar correctly with active tab', () => {
    useBrowserStore.mockImplementation((selector) => {
      // Mock the browser store state hook selector
      const state = {
        activeTab: { type: 'home' },
        continueWatching: [],
        recentMovies: [],
        recentTv: [],
        libraryContent: { all: [] },
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
  })
})
