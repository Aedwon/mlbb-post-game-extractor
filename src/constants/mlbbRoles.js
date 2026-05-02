// The 5 standard MLBB roles, lowercase tokens used in the data schema.
export const ROLES = ['gold', 'exp', 'mid', 'jungle', 'roam'];

// Industry-standard role display order for the wide-format CSV slot order.
// Differs from ROLES (which is alphabetical-ish for dropdown UX).
export const ROLE_DISPLAY_ORDER = ['exp', 'jungle', 'mid', 'roam', 'gold'];

// Human-readable labels for UI dropdowns.
export const ROLE_LABELS = {
  gold: 'Gold Lane',
  exp: 'EXP Lane',
  mid: 'Mid Lane',
  jungle: 'Jungle',
  roam: 'Roam',
};
