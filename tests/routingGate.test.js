import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import AuthRoute from '../src/pages/Auth'

let mockPathname = '/user-select'

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  Navigate: vi.fn().mockImplementation((props) => ({ type: 'Navigate', props }))
}))

vi.mock('../src/stores/AppStore', () => {
  const mockStore = () => ({
    isAuthenticated: true,
    hasServer: true,
    hasLibraries: true,
    hasSession: true
  })
  mockStore.getState = () => ({
    isAuthenticated: true,
    hasServer: true,
    hasLibraries: true,
    hasSession: true
  })
  return { useAppStore: mockStore }
})

describe('AuthRoute Routing Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = '/user-select'
  })

  it('should redirect to /login if requireAuth is true and user is not authenticated', () => {
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: false
    })
    expect(res.props.to).toBe('/login')
  })

  it('should allow accessing server-select if user has a completed session (to support switching servers)', () => {
    mockPathname = '/server-select'
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: true,
      hasSession: true,
      allowIncompleteSession: true
    })
    expect(res).toBe('Content')
  })

  it('should redirect to /server-select if no session and no server selected', () => {
    mockPathname = '/browse'
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: true,
      hasServer: false,
      hasSession: false,
      allowIncompleteSession: false
    })
    expect(res.props.to).toBe('/user-select')
  })

  it('should redirect straight to /user-select if no session but server is already selected and libraries are selected', () => {
    mockPathname = '/browse'
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: true,
      hasServer: true,
      hasLibraries: true,
      hasSession: false,
      allowIncompleteSession: false
    })
    expect(res.props.to).toBe('/user-select')
  })

  it('should allow children if all preconditions are satisfied', () => {
    mockPathname = '/browse'
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: true,
      hasServer: true,
      hasLibraries: true,
      hasSession: true
    })
    expect(res).toBe('Content')
  })
})
