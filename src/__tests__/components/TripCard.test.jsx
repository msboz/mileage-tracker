import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TripCard from '../../components/TripCard'

const trip = {
  startTime: { toDate: () => new Date('2026-04-02T09:00:00') },
  endTime: { toDate: () => new Date('2026-04-02T10:15:00') },
  startName: 'Home Office',
  startAddress: '123 Main St',
  endName: 'ABC Company',
  endAddress: '456 Oak Ave',
  miles: 18,
}

describe('TripCard', () => {
  it('renders trip number', () => {
    render(<TripCard trip={trip} index={0} />)
    expect(screen.getByText('Trip 1')).toBeInTheDocument()
  })

  it('shows location names when available', () => {
    render(<TripCard trip={trip} index={0} />)
    expect(screen.getByText(/Home Office/)).toBeInTheDocument()
    expect(screen.getByText(/ABC Company/)).toBeInTheDocument()
  })

  it('falls back to address when name is empty', () => {
    const t = { ...trip, startName: '', endName: '' }
    render(<TripCard trip={t} index={0} />)
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument()
  })

  it('displays miles', () => {
    render(<TripCard trip={trip} index={0} />)
    expect(screen.getByText(/18 mi/)).toBeInTheDocument()
  })
})
