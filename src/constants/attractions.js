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
