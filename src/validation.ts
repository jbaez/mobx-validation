import ValidationField from './validation-field';
import { makeObservable, observable, computed, action } from 'mobx';

export interface Validatable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// If is a string indicates it has error
export type ValidationError = string | undefined;

export interface ValidationAdapter {
  // Resolves with ValidationError.
  validate: (model: Validatable, property: string) => Promise<ValidationError>;
}

export type ValidationFields = {
  [key: string]: ValidationField;
};

/**
 * Validation
 */
class Validation {
  fields: ValidationFields = {};
  private isEnabled = false;
  private errorsInit = false; // abort early flag

  /**
   * Constructor.
   * @param model Model with validation.
   */
  constructor(model: Validatable, adapter: ValidationAdapter) {
    // setup validation fields
    for (const prop in model) {
      if (typeof model[prop] == 'function') {
        continue;
      }
      this.fields[prop] = new ValidationField({
        model: model,
        adapter,
        property: prop,
      });
    }
    // setup observables
    makeObservable<Validation, 'isEnabled'>(this, {
      fields: observable,
      setEnable: action,
      isEnabled: observable,
      hasErrors: computed,
    });
  }

  get hasErrors(): boolean {
    if (!this.isEnabled) {
      return false;
    }
    for (const prop in this.fields) {
      const field = this.fields[prop];
      if (field.error || field.isValidating) {
        return true;
      }
    }
    return false;
  }

  /**
   * Enable validation.
   * @param enable Enabled validation flag.
   */
  setEnable(enable: boolean) {
    this.isEnabled = enable;
    for (const prop in this.fields) {
      this.fields[prop].setEnable(this.isEnabled);
    }
  }

  /**
   * Checks if model validation passes.
   */
  async isValid(): Promise<boolean> {
    if (!this.isEnabled) {
      return true;
    }
    const promises = [];
    for (const prop in this.fields) {
      promises.push(this.fields[prop].isValid());
    }
    const results = await Promise.allSettled(promises);
    if (!this.errorsInit) {
      this.errorsInit = true;
    }
    return results.every((result) => result.status == 'fulfilled');
  }

  /**
   * Disposes validation.
   */
  dispose() {
    for (const prop in this.fields) {
      this.fields[prop].dispose();
    }
    this.fields = {};
  }
}

export default Validation;