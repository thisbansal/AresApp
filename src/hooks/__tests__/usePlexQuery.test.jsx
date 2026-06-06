import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlexQuery } from '../usePlexQuery'
import { useServerStore } from '../../stores/serverStore'
import { useAppStore } from '../../stores/AppStore'
import { getData, setData } from '../../services/luna/lunaService'

// Mock dependencies
vi.mock('../../services/luna/lunaService', () => ({
  getData: vi.fn(),
  setData: vi.fn(),
  DB_KINDS: { PREFERENCES: 'preferences' }
}))

vi.mock('../../stores/serverStore', () => ({
  useServerStore: vi.fn((selector) => {
    const state = { isOnline: true }
    return selector ? selector(state) : state
  })
}))

vi.mock('../../stores/AppStore', () => {
  const store = {
    getState: vi.fn(() => ({
      userProfile: { userId: '123' }
    }))
  }
  const useAppStore = vi.fn((selector) => {
    return selector ? selector(store.getState()) : store.getState()
  })
  useAppStore.getState = store.getState
  return { useAppStore }
})

describe('usePlexQuery SWR Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves cache instantly and triggers revalidation', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const fetchFn = vi.fn().mockReturnValue(fetchPromise);

    getData.mockResolvedValue(JSON.stringify(['cached_item']))

    let result;
    await act(async () => {
      const rendered = renderHook(() => usePlexQuery('test_key', fetchFn))
      result = rendered.result
    })

    // Assert cache was read instantly
    expect(getData).toHaveBeenCalled()
    expect(result.current.data).toEqual(['cached_item'])

    // Now resolve the revalidation fetch
    await act(async () => {
      resolveFetch(['fresh_item']);
      await fetchPromise;
    })

    // Assert revalidation completed and updated the state
    expect(fetchFn).toHaveBeenCalled()
    expect(result.current.data).toEqual(['fresh_item'])
    expect(setData).toHaveBeenCalledWith('preferences', expect.stringContaining('test_key'), JSON.stringify(['fresh_item']))
  })

  it('does not reset state if initialData is provided but query key remains identical', async () => {
    getData.mockResolvedValue(null)
    const fetchFn = vi.fn().mockResolvedValue(['fresh_item'])

    const initialData = ['initial']
    const { result, rerender } = renderHook(
      ({ queryKey, initial }) => usePlexQuery(queryKey, fetchFn, { initialData: initial }),
      { initialProps: { queryKey: 'static_key', initial: initialData } }
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(['initial'])

    // Re-render with new array reference for initialData but same key
    rerender({ queryKey: 'static_key', initial: ['initial'] })

    // It should NOT drop back to loading
    expect(result.current.loading).toBe(false)
  })
})
