import { formatTime } from '../services/export'

export default function TripCard({ trip, index, perMileRate }) {
  const from = trip.startName || trip.startAddress || 'Unknown'
  const to = trip.endName || trip.endAddress || 'Unknown'
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
    </div>
  )
}
