import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startTrip, endTrip, getLastOdometer, getActiveTrip, getTodaysTrips } from '../../services/trips'

vi.mock('../../firebase', () => ({ db: {} }))

const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: (...a) => mockAddDoc(...a),
  updateDoc: (...a) => mockUpdateDoc(...a),
  getDocs: (...a) => mockGetDocs(...a),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: () => ({ toDate: () => new Date('2026-04-02T09:00:00Z') }) },
}))

beforeEach(() => vi.clearAllMocks())

describe('startTrip', () => {
  it('creates a trip document with status in-progress and returns it with id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'trip123' })
    const result = await startTrip({
      userId: 'user1',
      startOdometer: 45230,
      startAddress: '123 Main St',
      startName: 'Home',
    })
    expect(result.id).toBe('trip123')
    expect(result.status).toBe('in-progress')
    expect(result.startOdometer).toBe(45230)
    expect(result.endTime).toBeNull()
    expect(mockAddDoc).toHaveBeenCalledOnce()
  })
})

describe('endTrip', () => {
  it('updates the trip document with end data and calculated miles', async () => {
    mockUpdateDoc.mockResolvedValue()
    const result = await endTrip('trip123', {
      endOdometer: 45248,
      endAddress: '456 Oak Ave',
      endName: 'ABC Co',
      startOdometer: 45230,
    })
    expect(result.miles).toBe(18)
    expect(result.status).toBe('completed')
    expect(result.endOdometer).toBe(45248)
    expect(mockUpdateDoc).toHaveBeenCalledOnce()
  })
})

describe('getLastOdometer', () => {
  it('returns endOdometer of most recent completed trip', async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ endOdometer: 45248 }) }],
    })
    const result = await getLastOdometer('user1')
    expect(result).toBe(45248)
  })

  it('returns null when no completed trips exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    const result = await getLastOdometer('user1')
    expect(result).toBeNull()
  })
})

describe('getActiveTrip', () => {
  it('returns the in-progress trip with its id', async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'trip123', data: () => ({ status: 'in-progress', startOdometer: 45230 }) }],
    })
    const result = await getActiveTrip('user1')
    expect(result.id).toBe('trip123')
    expect(result.status).toBe('in-progress')
  })

  it('returns null when no in-progress trip exists', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    const result = await getActiveTrip('user1')
    expect(result).toBeNull()
  })
})

describe('getTodaysTrips', () => {
  it('returns trips for today mapped with their ids', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'trip1', data: () => ({ status: 'completed', miles: 10 }) },
        { id: 'trip2', data: () => ({ status: 'in-progress', miles: null }) },
      ],
    })
    const result = await getTodaysTrips('user1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('trip1')
    expect(result[1].id).toBe('trip2')
  })
})
