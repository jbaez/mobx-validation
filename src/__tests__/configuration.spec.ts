import { makeObservable, observable, action } from 'mobx';
import { Validation } from '../validation';
import { configure, reset, ValidationAdapterFactory } from '../configuration';
import { YupAdapter } from '../adapters/yup-adapter';
import { string, number, object, ObjectSchema } from 'yup';

interface SelfValidatable {
  getValidation: () => ObjectSchema<unknown>;
}

/**
 * Model for testing validation.
 */
class ModelTest implements SelfValidatable {
  email = '';
  age = 16;
  constructor() {
    makeObservable(this, {
      email: observable,
      age: observable,
      setEmail: action,
      setAge: action,
    });
  }

  setEmail(email: string) {
    this.email = email;
  }

  setAge(age: number) {
    this.age = age;
  }

  getValidation(): ObjectSchema<{ email: string; age: number }> {
    return object({
      email: string().email().required(),
      age: number().min(18).integer().required(),
    });
  }
}

describe('validation global configuration', () => {
  beforeEach(() => {
    reset();
  });

  it('throws an error if trying to use validation without configured adapter', () => {
    expect(() => new Validation(new ModelTest())).toThrow();
  });

  it('configures and resets global configuration', () => {
    const model = new ModelTest();
    const schema = model.getValidation();
    configure({
      adapter: new YupAdapter(schema),
    });
    expect(() => new Validation(model)).not.toThrow();
    // reset global configuration
    reset();
    expect(() => new Validation(new ModelTest())).toThrow();
  });

  it('configures adapter globally using a factory function', async () => {
    const factory: ValidationAdapterFactory = (model) => {
      return new YupAdapter((model as SelfValidatable).getValidation());
    };
    configure({
      adapter: factory,
    });

    const model = new ModelTest();
    const sut = new Validation(model);
    sut.setEnable(true);
    await expect(sut.isValid()).resolves.toBe(false);
    model.setEmail('valid@test.com');
    model.setAge(19);
    await expect(sut.isValid()).resolves.toBe(true);
  });
});
