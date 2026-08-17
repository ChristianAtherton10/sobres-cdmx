// Sobres CDMX — capa de datos y proveedores externos
// El catálogo base (984 lugares verificados, dataset CDMX 2025) vive en data/lugares.js.
// Agrega API keys aquí para activar fuentes en vivo. El frontend funciona sin ellas.
export const API_KEYS = { ticketmaster: '', googlePlaces: '', foursquare: '', eventbrite: '' };

export const PROVIDERS = [
  { id: 'ticketmaster', name: 'Ticketmaster Discovery', use: 'Conciertos y eventos con boletos por fecha exacta (implementado: se activa al pegar la key)', status: 'Pendiente de API key' },
  { id: 'googlePlaces', name: 'Google Places API', use: 'Fotos, ratings, horarios y precios reales por lugar', status: 'Pendiente de API key' },
  { id: 'foursquare', name: 'Foursquare Places', use: 'Categorías, tips y venues emergentes', status: 'Pendiente de API key' },
  { id: 'eventbrite', name: 'Eventbrite', use: 'Talleres, pop-ups y eventos locales', status: 'Pendiente de API key' },
];

// Eventos reales de Ticketmaster para una fecha (YYYY-MM-DD) en CDMX.
// Devuelve null si no hay key (la app lo indica en la UI); [] si no hay eventos.
export async function fetchTicketmasterEvents(dateISO) {
  const key = API_KEYS.ticketmaster;
  if (!key) return null;
  const u = 'https://app.ticketmaster.com/discovery/v2/events.json?apikey=' + key
    + '&city=Mexico%20City&countryCode=MX&size=40&sort=relevance,desc'
    + '&startDateTime=' + dateISO + 'T00:00:00Z&endDateTime=' + dateISO + 'T23:59:59Z';
  try {
    const r = await fetch(u);
    if (!r.ok) return null;
    const j = await r.json();
    return (((j._embedded || {}).events) || []).map(e => ({
      id: 'tm-' + e.id, name: e.name,
      date: (e.dates && e.dates.start && e.dates.start.localDate) || dateISO,
      time: (e.dates && e.dates.start && e.dates.start.localTime) || '',
      venue: ((((e._embedded || {}).venues) || [])[0] || {}).name || '',
      url: e.url || ''
    }));
  } catch (e) { return null; }
}

export async function fetchVenues() { return null; } // catálogo base ya viene de data/lugares.js
