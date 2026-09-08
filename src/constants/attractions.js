/**
 * Attraction categories resolved by NAME rather than backend ID.
 *
 * Backend attraction IDs differ between environments (and have changed before),
 * so the app keys off the attraction name instead. Each constant below is a
 * stable string "kind" used throughout the app for category comparisons.
 *
 * Use `resolveCategory(attraction)` to turn a backend attraction object
 * (or name string) into one of these kinds.
 */
export const ACCOMMODATION = 'ACCOMMODATION';
export const FOOD_BEVERAGE = 'FOOD_BEVERAGE';
export const ENTERTAINMENT = 'ENTERTAINMENT';
export const SALONS_BEAUTY = 'SALONS_BEAUTY';
export const WELLNESS_FITNESS = 'WELLNESS_FITNESS';
export const GAMES_SPORTS = 'GAMES_SPORTS';

/**
 * Maps a normalized attraction name to its category kind.
 * Matching is done on a lowercased, keyword-based basis so minor backend
 * naming variations (e.g. "Salons and Beauty" vs "Salon & Beauty") still resolve.
 */
function matchCategoryByName(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();

  if (n.includes('accommodation') || n.includes('hotel') || n.includes('lodging')) {
    return ACCOMMODATION;
  }
  if (n.includes('food') || n.includes('beverage') || n.includes('restaurant') || n.includes('cafe') || n.includes('bar')) {
    return FOOD_BEVERAGE;
  }
  if (n.includes('entertainment') || n.includes('nightlife') || n.includes('club') || n.includes('theater') || n.includes('theatre')) {
    return ENTERTAINMENT;
  }
  if (n.includes('salon') || n.includes('beauty') || n.includes('grooming')) {
    return SALONS_BEAUTY;
  }
  if (n.includes('wellness') || n.includes('fitness') || n.includes('spa') || n.includes('gym')) {
    return WELLNESS_FITNESS;
  }
  if (n.includes('game') || n.includes('sport') || n.includes('recreation')) {
    return GAMES_SPORTS;
  }
  return null;
}

/**
 * Resolves an attraction (object with a `name`, or a raw name string) to a
 * stable category kind. Returns null if it can't be determined.
 *
 * @param {object|string|null|undefined} attraction
 * @returns {string|null} one of the category kind constants, or null
 */
export function resolveCategory(attraction) {
  if (!attraction) return null;
  const name = typeof attraction === 'string' ? attraction : attraction.name;
  return matchCategoryByName(name);
}

/**
 * Reservation model each category uses:
 *   - ROOMS  : room bookings          → Accommodation
 *   - TABLES : table reservations     → Food & Beverage, Entertainment and Nightlife
 *   - SLOTS  : slot reservations      → Salons and Beauty, Games and Sports, Wellness and Fitness
 */
export const RESERVATION_ROOMS = 'ROOMS';
export const RESERVATION_TABLES = 'TABLES';
export const RESERVATION_SLOTS = 'SLOTS';

const CATEGORY_TO_RESERVATION = {
  [ACCOMMODATION]: RESERVATION_ROOMS,
  [FOOD_BEVERAGE]: RESERVATION_TABLES,
  [ENTERTAINMENT]: RESERVATION_TABLES,
  [SALONS_BEAUTY]: RESERVATION_SLOTS,
  [GAMES_SPORTS]: RESERVATION_SLOTS,
  [WELLNESS_FITNESS]: RESERVATION_SLOTS,
};

/**
 * Returns the reservation kind (ROOMS | TABLES | SLOTS) for a resolved
 * category. Unknown categories default to SLOTS (the generic booking model).
 *
 * @param {string|null} category - a category kind (from resolveCategory)
 * @returns {string} one of RESERVATION_ROOMS | RESERVATION_TABLES | RESERVATION_SLOTS
 */
export function reservationTypeFor(category) {
  return CATEGORY_TO_RESERVATION[category] || RESERVATION_SLOTS;
}

/** Convenience predicates for the three reservation models. */
export const usesRoomBookings = (category) => reservationTypeFor(category) === RESERVATION_ROOMS;
export const usesTableReservations = (category) => reservationTypeFor(category) === RESERVATION_TABLES;
export const usesSlotReservations = (category) => reservationTypeFor(category) === RESERVATION_SLOTS;
