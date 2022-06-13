import { ValidationField } from './validation-field';
import { getAdapter } from './configuration';
import { makeObservable, observable, computed, action } from 'mobx';

export type Validatable = Record<string, any>;
export type ValidationArrayError = (string | null)[];
export type ValidationError = string | ValidationArrayError | undefined;

export interface ValidationAdapter {
  // Returns the fields to validate. Empty defaults to all props of model.
  getFields: (model: Validatable) => string[];
  // Resolves with ValidationError.
  validate: (model: Validatable, property: string) => Promise<ValidationError>;
}

export type ValidationFields<T extends Validatable> = {
  [K in keyof T]?: ValidationField;
};

/**
 * Validation
 */
export class Validation<T extends Validatable> {
  fields: ValidationFields<T> = {};
  private isEnabled = false;
  private errorsInit = false; // abort early flag

  /**
   * Constructor.
   * @param model Model with validation.
   */
  constructor(model: T, adapter?: ValidationAdapter) {
    if (!adapter) {
      adapter = getAdapter(model);
    }
    // setup validation fields
    const fields = adapter.getFields(model);
    if (fields.length) {
      for (const field of fields) {
        //@ts-expect-error The string field should be an index of fields
        this.fields[field] = new ValidationField({
          model: model,
          adapter,
          property: field,
        });
      }
    } else {
      // default to add all props in model
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
    }

    // setup observables
    makeObservable<Validation<T>, 'isEnabled'>(this, {
      fields: observable,
      setEnable: action,
      isEnabled: observable,
      hasErrors: computed,
      dispose: action,
    });
  }

  get hasErrors(): boolean {
    if (!this.isEnabled) {
      return false;
    }
    for (const prop in this.fields) {
      const field = this.fields[prop];
      if (!field) continue;
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
      this.fields[prop]?.setEnable(this.isEnabled);
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
      promises.push(this.fields[prop]?.isValid());
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
      this.fields[prop]?.dispose();
    }
    this.fields = {};
  }
}
