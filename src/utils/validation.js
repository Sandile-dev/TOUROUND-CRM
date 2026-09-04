/**
 * Shared validation utilities for all forms.
 */

export const rules = {
  required: (value, label = 'Field') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${label} is required`;
    }
    return '';
  },

  minLength: (value, min, label = 'Field') => {
    if (value && value.trim().length < min) {
      return `${label} must be at least ${min} characters`;
    }
    return '';
  },

  positiveNumber: (value, label = 'Field') => {
    if (value !== '' && value !== null && value !== undefined) {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return `${label} must be a positive number`;
      }
    }
    return '';
  },

  email: (value, label = 'Email') => {
    if (!value) return '';
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(value)) {
      return `${label} is not a valid email address`;
    }
    return '';
  },

  futureOrToday: (value, label = 'Date') => {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    if (date < today) {
      return `${label} must be today or in the future`;
    }
    return '';
  },
};

/**
 * Validate a form object against a schema.
 * Returns { valid: boolean, errors: { fieldName: string } }
 */
export function validateForm(form, schema) {
  const errors = {};
  for (const [field, validators] of Object.entries(schema)) {
    for (const { rule, params = [], label } of validators) {
      const error = rule(form[field], ...params, label || field);
      if (error) {
        errors[field] = error;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
