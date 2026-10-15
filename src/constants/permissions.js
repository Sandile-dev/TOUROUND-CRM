/**
 * Staff permissions / feature-access model.
 *
 * The backend stores a staff member's `permissions` as a free-form list of
 * strings (round-tripped verbatim). The app owns that vocabulary: each string is
 * a FEATURE key that maps to a screen/tab. A business OWNER has `['*']` (all).
 *
 * Role presets below mirror the roles shown in Staff management and decide which
 * features a newly created staff member of that role can access.
 */

// Canonical feature keys used across navigation and permission checks.
export const FEATURES = {
  DASHBOARD: 'Dashboard',
  POSTS: 'Posts',
  SERVICES: 'Services',
  RESERVATIONS: 'Reservations',
  TICKETS: 'Tickets',
  CUSTOMERS: 'Customers',
  PAYMENTS: 'Payments',
  PROMOTIONS: 'Promotions',
  SALES: 'Sales',
  REVIEWS: 'Reviews',
  ANALYTICS: 'Analytics',
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'Messages',
};

// Permissions granted to each staff role when created/updated.
export const ROLE_PERMISSIONS = {
  OWNER: ['*'],
  MANAGER: [
    'Dashboard', 'Posts', 'Services', 'Reservations', 'Tickets', 'Customers',
    'Payments', 'Promotions', 'Sales', 'Reviews', 'Analytics', 'Notifications', 'Messages',
  ],
  RECEPTIONIST: ['Dashboard', 'Reservations', 'Tickets', 'Customers', 'Messages', 'Notifications'],
  FINANCE: ['Dashboard', 'Payments', 'Sales', 'Analytics', 'Notifications'],
  MARKETING: ['Dashboard', 'Posts', 'Promotions', 'Reviews', 'Analytics', 'Notifications'],
  EVENTS: ['Dashboard', 'Tickets', 'Reservations', 'Customers', 'Notifications'],
};

// The permission list for a given role (defaults to a minimal dashboard-only set).
export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ['Dashboard'];
}

/**
 * Returns true if the user may access the given feature.
 * - No user / not a staff member (owner) => full access.
 * - Owner permissions `['*']` => full access.
 * - Otherwise the feature must be present in the user's permissions list.
 */
export function hasPermission(user, feature) {
  if (!user) return false;
  // Owners (and any non-staff business account) have unrestricted access.
  if (!user.isStaff) return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('*')) return true;
  return perms.includes(feature);
}
