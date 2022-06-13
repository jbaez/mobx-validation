import { Validatable, Validation } from './validation';
import { makeObservable, computed } from 'mobx';

/**
 * Validation Group
 */
export class ValidationGroup<Fields extends string, T extends Validatable> {
  readonly item: Record<Fields, Validation<T>>;

  constructor(validations: Record<Fields, Validation<T>>) {
    this.item = validations;
    makeObservable(this, {
      hasErrors: computed,
    });
  }

  private loopValidations(callback: (validation: Validation<T>) => void) {
    for (const key in this.item) {
      callback(this.item[key]);
    }
  }

  get hasErrors(): boolean {
    for (const key in this.item) {
      if (this.item[key].hasErrors) {
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
    this.loopValidations((validation) => validation.setEnable(enable));
  }

  /**
   * Checks if all model validations passes.
   */
  async isValid(): Promise<boolean> {
    const promises: Promise<boolean>[] = [];
    this.loopValidations((validation) => promises.push(validation.isValid()));
    const results = await Promise.allSettled(promises);
    return results.every((result) =>
      result.status == 'fulfilled' ? result.value : false
    );
  }

  /**
   * Disposes validation.
   */
  dispose() {
    this.loopValidations((validation) => validation.dispose);
  }
}
