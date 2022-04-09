import Validation from './validation';
import { makeObservable, computed } from 'mobx';

/**
 * Validation Group
 */
class ValidationGroup<Fields extends string> {
  readonly item: Record<Fields, Validation>;

  constructor(validations: Record<Fields, Validation>) {
    this.item = validations;
    makeObservable(this, {
      hasErrors: computed,
    });
  }

  private loopValidations(callback: (validation: Validation) => void) {
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

export default ValidationGroup;
