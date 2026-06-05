import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock WebOS properties globally
window.webOS = {
  fetchAppId: vi.fn().mockReturnValue('com.nookbyte.aresapp'),
  deviceInfo: vi.fn((cb) => cb({ modelName: 'Test WebOS TV' })),
  systemInfo: vi.fn((cb) => cb({ country: 'US' }))
}

// Mock webOSTV API properties
window.webOSSystem = {
  getCountry: vi.fn().mockReturnValue('US'),
  getDeviceID: vi.fn().mockReturnValue('dummy-device-id')
}
