import { formatTime } from '../services/export'

export default function TripCard({ trip, index, perMileRate }) {
  const from = trip.startAddress || 'Unknown'
  const to = trip.endAddress || 'Unknown'
  const reimb = perMileRate != null
    ? `$${((trip.miles || 0) * perMileRate).toFixed(2)}`
    : null

  return (
    <div className="trip-card">
      <div className="trip-number">Trip {index + 1}</div>
      <div className="trip-times">
        {formatTime(trip.startTime)} → {formatTime(trip.endTime)}
      </div>
      <div className="trip-route">{from} → {to}</div>
      <div className="trip-miles">{trip.miles} mi</div>
      {reimb && <div className="trip-reimb">Reimbursement: {reimb}</div>}
      {trip.equipment && (
        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
          🚗 {trip.equipment}
        </div>
      )}
      {trip.notes && (
        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>
          📝 {trip.notes}
        </div>
      )}
    </div>
  )
}
