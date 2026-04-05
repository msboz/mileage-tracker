export async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const address = await reverseGeocode(latitude, longitude)
          resolve({ latitude, longitude, address })
        } catch {
          resolve({ latitude, longitude, address: '' })
        }
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error('Geocoding failed')
  const data = await res.json()
  const a = data.address || {}
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const city = a.city || a.town || a.village || a.hamlet || ''
  const state = a.state || ''
  const zip = a.postcode || ''
  return [street, city, state, zip].filter(Boolean).join(', ')
}
