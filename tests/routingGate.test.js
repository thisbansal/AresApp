import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import AuthRoute from '../src/pages/Auth'

let mockPathname = '/user-select'

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  Navigate: vi.fn().mockImplementation((props) => ({ type: 'Navigate', props }))
}))

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

  it('should redirect to /browse if user tries to access server-select with completed session', () => {
    mockPathname = '/server-select'
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: true,
      hasSession: true
    })
    expect(res.props.to).toBe('/browse')
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
    expect(res.props.to).toBe('/server-select')
  })

  it('should redirect straight to /user-select if no session but server is already selected', () => {
    mockPathname = '/browse'
    const res = AuthRoute({
      children: 'Content',
      requireAuth: true,
      isAuthenticated: true,
      hasServer: true,
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
      hasSession: true
    })
    expect(res).toBe('Content')
  })
})
