import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LibrarySelectPage from '../LibrarySelectPage'
import { useServerManagerStore } from '../../stores/serverManagerStore'
import { getLibraries } from '../../services/plex/plexContentService'

// Component is default exported? Let's assume yes or destructure if named export
// Based on imports, let's mock the services
vi.mock('../../services/plex/plexContentService', () => ({
  getLibraries: vi.fn()
}))

vi.mock('../../stores/serverManagerStore', () => ({
  useServerManagerStore: {
    getState: vi.fn(),
    setState: vi.fn()
  }
}))

vi.mock('../../stores/AppStore', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      selectedLibraryIds: [],
      selectedLibrariesByServer: {}
    }))
  }
}))

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

describe('LibrarySelectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    // We mock getLibraries to return a promise that never resolves yet
    getLibraries.mockReturnValue(new Promise(() => {}))
    useServerManagerStore.getState.mockReturnValue({
      servers: {
        '123': { uri: 'http://local', accessToken: 'token', owned: true }
      }
    })

    const { container } = render(
      <MemoryRouter>
        <LibrarySelectPage />
      </MemoryRouter>
    )

    // The component has a div with text "Discovering libraries..."
    expect(container.innerHTML).toContain('Discovering libraries...')
  })

  it('displays error if server connection details are missing', async () => {
    useServerManagerStore.getState.mockReturnValue({ servers: {} })

    render(
      <MemoryRouter>
        <LibrarySelectPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Plex Server Took a Nap/i)).toBeInTheDocument()
    })
  })

  it('fetches libraries and displays them', async () => {
    useServerManagerStore.getState.mockReturnValue({
      servers: {
        'server-123': { uri: 'http://local', accessToken: 'token', owned: true }
      }
    })

    getLibraries.mockResolvedValue([
      { id: '1', title: 'Movies', type: 'movie' },
      { id: '2', title: 'TV Shows', type: 'show' }
    ])

    render(
      <MemoryRouter>
        <LibrarySelectPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument()
      expect(screen.getByText('TV Shows')).toBeInTheDocument()
    })
  })
})
