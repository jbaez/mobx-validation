import { Validatable, ValidationAdapter } from './validation';
import { makeObservable, observable, computed, action, reaction } from 'mobx';

export interface ValidationFieldParams {
  model: Validatable;
  adapter: ValidationAdapter;
  property: string;
}

/**
 * Validation Field
 */
class ValidationField {
  private model: Validatable;
  private adapter: ValidationAdapter;
  private property: string;
  private currentError = '';
  private isEnabled = false;
  private inProgressCount = 0;
  private modelSubscription;

  constructor({ model, adapter, property }: ValidationFieldParams) {
    this.model = model;
    this.adapter = adapter;
    this.property = property;
    this.currentError = '';

    makeObservable<
      ValidationField,
      | 'currentError'
      | 'isEnabled'
      | 'setCurrentError'
      | 'inProgressCount'
      | 'addInProgressCount'
      | 'removeInProgressCount'
    >(this, {
      error: computed,
      currentError: observable,
      setCurrentError: action,
      isEnabled: observable,
      setEnable: action,
      inProgressCount: observable,
      addInProgressCount: action,
      removeInProgressCount: action,
      isValidating: computed,
    });
    this.modelSubscription = reaction(
      () => this.model[property],
      () => {
        this.runValidation();
      }
    );
  }

  private validationMemo = computed(
    async () => {
      if (!this.isEnabled) {
        this.setCurrentError('');
        return true;
      }
      this.addInProgressCount();
      const validationError = await this.adapter.validate(
        this.model,
        this.property
      );
      this.removeInProgressCount();
      if (validationError) {
        this.setCurrentError(validationError);
        throw validationError;
      }
      this.setCurrentError('');
      return true;
    },
    { keepAlive: true }
  );

  private runValidation() {
    this.validationMemo.get().catch(() => undefined); // handle error
  }

  private setCurrentError(error: string) {
    this.currentError = error;
  }

  private addInProgressCount() {
    this.inProgressCount += 1;
  }

  private removeInProgressCount() {
    this.inProgressCount -= 1;
  }

  get error(): string {
    return this.currentError;
  }

  get isValidating(): boolean {
    return this.inProgressCount > 0;
  }

  async isValid(): Promise<boolean> {
    return this.validationMemo.get();
  }

  setEnable(enable: boolean) {
    this.isEnabled = enable;
    this.runValidation();
  }

  dispose() {
    this.modelSubscription();
  }
}

export default ValidationField;
