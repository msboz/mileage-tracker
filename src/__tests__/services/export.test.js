import { describe, it, expect } from 'vitest'
import { generateCSV, formatTime } from '../../services/export'

const mockTrips = [
  {
    date: '2026-04-02',
    startTime: { toDate: () => new Date('2026-04-02T09:00:00') },
    endTime: { toDate: () => new Date('2026-04-02T10:15:00') },
    startOdometer: 45230,
    endOdometer: 45248,
    miles: 18,
    startAddress: '123 Main St, Springfield',
    startName: 'Home Office',
    endAddress: '456 Oak Ave, Springfield',
    endName: 'ABC Company',
  },
]

describe('formatTime', () => {
  it('formats a Firestore-style timestamp object', () => {
    const ts = { toDate: () => new Date('2026-04-02T09:00:00') }
    const result = formatTime(ts)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('')
  })

  it('formats a plain Date object', () => {
    const result = formatTime(new Date('2026-04-02T14:30:00'))
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('generateCSV', () => {
  it('returns only the header row for empty trips array', () => {
    const csv = generateCSV([])
    expect(csv).toBe(
      'Date,Trip #,Start Time,End Time,Start Odometer,End Odometer,Miles,Start Address,Start Name,End Address,End Name'
    )
  })

  it('generates one data row per trip', () => {
    const csv = generateCSV(mockTrips)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('includes all numeric fields in the row', () => {
    const csv = generateCSV(mockTrips)
    expect(csv).toContain('2026-04-02')
    expect(csv).toContain('45230')
    expect(csv).toContain('45248')
    expect(csv).toContain('18')
  })

  it('wraps address and name fields in double quotes', () => {
    const csv = generateCSV(mockTrips)
    expect(csv).toContain('"ABC Company"')
    expect(csv).toContain('"123 Main St, Springfield"')
  })

  it('escapes double quotes inside field values', () => {
    const trip = { ...mockTrips[0], startName: 'Bob\'s "Best" Shop' }
    const csv = generateCSV([trip])
    expect(csv).toContain('"Bob\'s ""Best"" Shop"')
  })

  it('numbers trips starting at 1', () => {
    const twoTrips = [mockTrips[0], { ...mockTrips[0] }]
    const csv = generateCSV(twoTrips)
    const lines = csv.split('\n')
    expect(lines[1]).toMatch(/^2026-04-02,1,/)
    expect(lines[2]).toMatch(/^2026-04-02,2,/)
  })
})
