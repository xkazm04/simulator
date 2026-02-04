/**
 * Validation Pipeline - Declarative, composable validation system
 *
 * Provides a fluent API for building validation pipelines with pluggable rules.
 * Supports file validation, string validation, and custom validators.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export type ValidatorFn<T> = (value: T) => ValidationResult;

// ============================================================================
// VALIDATION PIPELINE
// ============================================================================

/**
 * Generic validation pipeline that chains validators
 */
export class ValidationPipeline<T> {
  private validators: ValidatorFn<T>[] = [];

  /**
   * Add a validator to the pipeline
   */
  add(validator: ValidatorFn<T>): this {
    this.validators.push(validator);
    return this;
  }

  /**
   * Run all validators in sequence, stopping at first failure
   */
  validate(value: T): ValidationResult {
    for (const validator of this.validators) {
      const result = validator(value);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  }

  /**
   * Run all validators and collect all errors
   */
  validateAll(value: T): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const validator of this.validators) {
      const result = validator(value);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

// ============================================================================
// FILE VALIDATORS
// ============================================================================

/**
 * Validates file MIME type against allowed formats
 */
export function fileTypeValidator(
  allowedTypes: string[],
  displayFormats?: string
): ValidatorFn<File> {
  const formatsDisplay = displayFormats || allowedTypes.join(', ');
  return (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported format. Please use ${formatsDisplay}.`,
      };
    }
    return { valid: true };
  };
}

/**
 * Validates file size against maximum allowed
 */
export function fileSizeValidator(
  maxSizeBytes: number,
  displayUnit: 'KB' | 'MB' = 'MB'
): ValidatorFn<File> {
  const divisor = displayUnit === 'MB' ? 1024 * 1024 : 1024;
  const maxDisplay = (maxSizeBytes / divisor).toFixed(0);

  return (file: File) => {
    if (file.size > maxSizeBytes) {
      const sizeDisplay = (file.size / divisor).toFixed(1);
      return {
        valid: false,
        error: `File too large (${sizeDisplay}${displayUnit}). Maximum size is ${maxDisplay}${displayUnit}.`,
      };
    }
    return { valid: true };
  };
}

/**
 * Validates that a file exists (is not null/undefined)
 */
export function fileRequiredValidator(message?: string): ValidatorFn<File | null | undefined> {
  return (file) => {
    if (!file) {
      return {
        valid: false,
        error: message || 'File is required.',
      };
    }
    return { valid: true };
  };
}

// ============================================================================
// STRING VALIDATORS
// ============================================================================

/**
 * Validates string is not empty
 */
export function requiredValidator(fieldName?: string): ValidatorFn<string> {
  return (value: string) => {
    if (!value || value.trim().length === 0) {
      return {
        valid: false,
        error: fieldName ? `${fieldName} is required.` : 'This field is required.',
      };
    }
    return { valid: true };
  };
}

/**
 * Validates string length
 */
export function lengthValidator(
  min: number,
  max: number,
  fieldName?: string
): ValidatorFn<string> {
  return (value: string) => {
    const len = value.length;
    if (len < min) {
      return {
        valid: false,
        error: fieldName
          ? `${fieldName} must be at least ${min} characters.`
          : `Must be at least ${min} characters.`,
      };
    }
    if (len > max) {
      return {
        valid: false,
        error: fieldName
          ? `${fieldName} must be at most ${max} characters.`
          : `Must be at most ${max} characters.`,
      };
    }
    return { valid: true };
  };
}

/**
 * Validates string matches a pattern
 */
export function patternValidator(
  pattern: RegExp,
  message: string
): ValidatorFn<string> {
  return (value: string) => {
    if (!pattern.test(value)) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
}

// ============================================================================
// PRE-CONFIGURED FILE VALIDATORS
// ============================================================================

/**
 * Image file validation constants
 */
export const IMAGE_VALIDATION = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  FORMATS: ['image/jpeg', 'image/png', 'image/webp'] as const,
  FORMATS_DISPLAY: 'JPEG, PNG, or WebP',
  ACCEPT: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
};

/**
 * Pre-configured image file validator pipeline
 */
export function createImageValidator(): ValidationPipeline<File> {
  return new ValidationPipeline<File>()
    .add(fileTypeValidator([...IMAGE_VALIDATION.FORMATS], IMAGE_VALIDATION.FORMATS_DISPLAY))
    .add(fileSizeValidator(IMAGE_VALIDATION.MAX_SIZE, 'MB'));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a custom validator from a predicate function
 */
export function createValidator<T>(
  predicate: (value: T) => boolean,
  errorMessage: string
): ValidatorFn<T> {
  return (value: T) => {
    if (!predicate(value)) {
      return { valid: false, error: errorMessage };
    }
    return { valid: true };
  };
}

/**
 * Combine multiple validators into one that fails fast
 */
export function combineValidators<T>(...validators: ValidatorFn<T>[]): ValidatorFn<T> {
  return (value: T) => {
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  };
}
