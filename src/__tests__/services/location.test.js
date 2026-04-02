import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reverseGeocode, getCurrentLocation } from '../../services/location'

beforeEach(() => vi.resetAllMocks())

describe('reverseGeocode', () => {
  it('returns display_name from Nominatim API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ display_name: '123 Main St, Springfield, IL' }),
    })
    const result = await reverseGeocode(39.7, -89.6)
    expect(result).toBe('123 Main St, Springfield, IL')
    expect(fetch).toHaveBeenCalledWith(
      'https://nominatim.openstreetmap.org/reverse?lat=39.7&lon=-89.6&format=json',
      { headers: { 'Accept-Language': 'en' } }
    )
  })

  it('throws when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    await expect(reverseGeocode(0, 0)).rejects.toThrow('Geocoding failed')
  })
})

describe('getCurrentLocation', () => {
  it('resolves with latitude, longitude and address', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ display_name: '456 Oak Ave' }),
    })
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: { latitude: 39.7, longitude: -89.6 } })
        ),
      },
      writable: true,
      configurable: true,
    })
    const result = await getCurrentLocation()
    expect(result).toEqual({ latitude: 39.7, longitude: -89.6, address: '456 Oak Ave' })
  })

  it('rejects when geolocation is not supported', async () => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    await expect(getCurrentLocation()).rejects.toThrow('Geolocation not supported')
  })

  it('resolves with empty address when geocoding fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: { latitude: 0, longitude: 0 } })
        ),
      },
      writable: true,
      configurable: true,
    })
    const result = await getCurrentLocation()
    expect(result.address).toBe('')
  })
})
