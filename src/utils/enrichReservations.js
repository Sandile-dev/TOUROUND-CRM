import apiClient from '../api/client';

/**
 * Enriches a list of reservation/booking objects whose `totalPrice` is null
 * by looking up the price from the associated service (slot, room, or table).
 *
 * The backend creates reservations without persisting `totalPrice` on the
 * reservation row itself; the price lives on the service entity. This helper
 * resolves that gap by fetching the relevant service by its stored id and
 * copying the price across.
 *
 * It mutates the items in-place (for performance) and returns the same array.
 *
 * @param {Array}  items - reservation/booking objects from the API.
 * @param {string} type  - 'slots' | 'rooms' | 'tables'
 * @returns {Promise<Array>} - the enriched items array
 */
export async function enrichReservationAmounts(items, type) {
  if (!Array.isArray(items) || items.length === 0) return items;

  // Only enrich rows that are genuinely missing a price.
  const needsEnrichment = items.filter((r) => r.totalPrice == null || r.totalPrice === 0);
  if (needsEnrichment.length === 0) return items;

  // Collect unique service ids for the items that need enrichment.
  const serviceIds = [...new Set(
    needsEnrichment
      .map((r) => r.businessSlotId || r.roomId || r.businessTableId)
      .filter((id) => id != null)
  )];

  if (serviceIds.length === 0) return items;

  // Fetch each service and build a price-by-id cache.
  const priceCache = {};
  await Promise.all(serviceIds.map(async (id) => {
    try {
      let path;
      if (type === 'slots')  path = `/business-slots/${id}`;
      else if (type === 'rooms')  path = `/accommodation/rooms/${id}`;
      else if (type === 'tables') path = `/business-tables/${id}`;
      else return;

      const r = await apiClient.get(path);
      const svc = r.data;
      // Pick the price field that matches the service type.
      const price =
        svc.slotPrice ??        // slot
        svc.pricePerNight ??    // room
        svc.tablePrice ??       // table
        svc.price ??
        null;
      if (price != null) priceCache[id] = Number(price);
    } catch {}
  }));

  // Apply the cached price to each item that needs it.
  items.forEach((r) => {
    if (r.totalPrice != null && r.totalPrice !== 0) return; // already has a price
    const serviceId = r.businessSlotId || r.roomId || r.businessTableId;
    if (serviceId != null && priceCache[serviceId] != null) {
      const guests = r.numberOfGuests || r.capacity || 1;
      r.totalPrice = priceCache[serviceId] * guests;
    }
  });

  return items;
}
