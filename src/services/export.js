export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function generateCSV(trips) {
  const header =
    'Date,Trip #,Start Time,End Time,Start Odometer,End Odometer,Miles,Start Address,Start Name,End Address,End Name'
  const rows = trips.map((trip, index) => {
    const q = (s) => `"${(s || '').replace(/"/g, '""')}"`
    return [
      trip.date,
      index + 1,
      formatTime(trip.startTime),
      formatTime(trip.endTime),
      trip.startOdometer,
      trip.endOdometer,
      trip.miles,
      q(trip.startAddress),
      q(trip.startName),
      q(trip.endAddress),
      q(trip.endName),
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export async function shareCSV(trips, date, recipientEmail) {
  const csv = generateCSV(trips)
  const filename = `mileage-log-${date}.csv`
  const file = new File([csv], filename, { type: 'text/csv' })
  const totalMiles = trips.reduce((sum, t) => sum + (t.miles || 0), 0)
  const shareData = {
    title: `Mileage Log - ${date}`,
    text: `Mileage log for ${date}.\nTrips: ${trips.length} | Total miles: ${totalMiles}\n\nPlease send to: ${recipientEmail || '(set recipient in Settings)'}`,
    files: [file],
  }
  if (navigator.canShare && navigator.canShare(shareData)) {
    await navigator.share(shareData)
  } else {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
