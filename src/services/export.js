export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function generateCSV(trips, perMileRate = 0.67) {
  const header =
    'Date,Trip #,Start Time,End Time,Start Odometer,End Odometer,Miles,Reimbursement,Start Address,Start Name,End Address,End Name'
  const rows = trips.map((trip, index) => {
    const q = (s) => `"${(s || '').replace(/"/g, '""')}"`
    const reimb = ((trip.miles || 0) * perMileRate).toFixed(2)
    return [
      trip.date,
      index + 1,
      formatTime(trip.startTime),
      formatTime(trip.endTime),
      trip.startOdometer,
      trip.endOdometer,
      trip.miles,
      reimb,
      q(trip.startAddress),
      q(trip.startName),
      q(trip.endAddress),
      q(trip.endName),
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

export async function shareCSV(trips, date, recipientEmail, perMileRate = 0.67, userName = '') {
  const csv = generateCSV(trips, perMileRate)
  const filename = `mileage-log-${date}.csv`
  const file = new File([csv], filename, { type: 'text/csv' })
  const totalMiles = trips.reduce((sum, t) => sum + (t.miles || 0), 0)
  const totalReimb = (totalMiles * perMileRate).toFixed(2)

  // Format date as M/D/YY  e.g. "4/4/26"
  const [year, month, day] = date.split('-')
  const shortDate = `${parseInt(month, 10)}/${parseInt(day, 10)}/${year.slice(2)}`
  const subject = userName
    ? `Mileage for ${userName}-${shortDate}`
    : `Mileage Log - ${shortDate}`

  const shareData = {
    title: subject,
    text: `${subject}\nTrips: ${trips.length} | Total miles: ${totalMiles} | Reimbursement: $${totalReimb}\n\nSend to: ${recipientEmail || '(set recipient in Global Settings)'}`,
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
