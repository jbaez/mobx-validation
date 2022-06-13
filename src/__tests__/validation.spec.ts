import { Validation, Validatable, ValidationFields } from '../validation';
import { ValidationGroup } from '../validation-group';
import { YupAdapter } from '../adapters/yup-adapter';
import { makeObservable, observable, action, reaction } from 'mobx';
import { string, number, array, object, ObjectSchema } from 'yup';

/**
 * Remote validation method mock
 */
const remoteValidationMock = jest
  .fn<Promise<{ result: boolean }>, [boolean]>()
  .mockImplementation((remoteValid: boolean): Promise<{ result: boolean }> => {
    return Promise.resolve({ result: remoteValid });
  });

/**
 * Model for testing validation.
 */
class ModelTest implements Validatable {
  email = '';
  age = 16;
  otherEmails: string[] = [];
  notValidatedProp = 1;
  constructor() {
    makeObservable(this, {
      email: observable,
      age: observable,
      setEmail: action,
      setAge: action,
      otherEmails: observable.ref,
      setOtherEmails: action,
    });
  }

  setEmail(email: string) {
    this.email = email;
  }

  setAge(age: number) {
    this.age = age;
  }

  setOtherEmails(emails: string[]) {
    this.otherEmails = [...emails];
  }
}

const otherEmailsRequired = 'this is required';
const otherEmailsValid = 'must be a valid email';

function getValidationSchema(
  remoteValid = true
): ObjectSchema<{ email: string; age: number }> {
  return object({
    email: string()
      .email()
      .required()
      .test('remote-email', '${path} is already in use', async () => {
        const response = await remoteValidationMock(remoteValid);
        return response.result;
      }),
    age: number().min(18).integer().required(),
    otherEmails: array().of(
      string().required(otherEmailsRequired).email(otherEmailsValid)
    ),
  });
}

/**
 * Test suite
 */
describe('Validation', () => {
  let sut: Validation<ModelTest>;
  let model: ModelTest;
  let adapter: YupAdapter;

  describe('Remote validation success', () => {
    beforeEach(() => {
      model = new ModelTest();
      adapter = new YupAdapter(getValidationSchema());
      sut = new Validation(model, adapter);
    });

    it('validates model values with "isValid" and sets errors', async () => {
      let fields: ValidationFields<ModelTest>;
      await expect(sut.isValid()).resolves.toBe(true);
      fields = sut.fields;
      expect(fields.email?.error).toBeFalsy();
      expect(fields.age?.error).toBeFalsy();
      expect(sut.hasErrors).toBeFalsy();

      sut.setEnable(true);
      await expect(sut.isValid()).resolves.toBe(false);
      fields = sut.fields;
      expect(sut.hasErrors).toBeTruthy();
      expect(fields.email?.error).toBeTruthy();
      expect(fields.age?.error).toBeTruthy();

      model.setAge(18);
      model.setEmail('invalid');
      await expect(sut.isValid()).resolves.toBe(false);
      fields = sut.fields;
      expect(fields.email?.error).toBeTruthy();
      expect(fields.age?.error).toBeFalsy();
      expect(sut.hasErrors).toBeTruthy();

      model.setEmail('test@test.com');
      await expect(sut.isValid()).resolves.toBe(true);
      fields = sut.fields;
      expect(fields.email?.error).toBeFalsy();
      expect(fields.age?.error).toBeFalsy();
      expect(sut.hasErrors).toBeFalsy();
    });

    it('validates all on setEnable(true)', async () => {
      let resolveChangeWait: (value: boolean) => void;
      const waitForChange = new Promise((resolve) => {
        resolveChangeWait = resolve;
      });
      const subscription = reaction(
        () => sut.fields.age?.error,
        () => {
          resolveChangeWait(true);
        }
      );
      sut.setEnable(true);
      await waitForChange;
      subscription();
      expect(sut.fields.age?.error).toBeTruthy();
      expect(sut.fields.email?.error).toBeTruthy();
      expect(sut.hasErrors).toBeTruthy();
    });

    it('resets validation on setEnable(false)', async () => {
      sut.setEnable(true);
      await expect(sut.isValid()).resolves.toBe(false);
      // setup change subscription
      let resolveChangeWait: (value: boolean) => void;
      const waitForChange = new Promise((resolve) => {
        resolveChangeWait = resolve;
      });
      const subscription = reaction(
        () => sut.fields.age?.error,
        () => {
          resolveChangeWait(true);
        }
      );
      // reset validation
      sut.setEnable(false);
      await waitForChange;
      subscription();
      // errors should clear reactively
      expect(sut.fields.age?.error).toBeFalsy();
      expect(sut.fields.email?.error).toBeFalsy();
      expect(sut.hasErrors).toBeFalsy();
      // and validation should pass now
      await expect(sut.isValid()).resolves.toBe(true);
    });

    it('re-validates reactively on value change', async () => {
      model.setEmail('test@test.com');
      sut.setEnable(true);
      expect(sut.fields.age?.error).toBeFalsy();
      let resolveChangeWait: (value: boolean) => void;
      const waitForChange = new Promise((resolve) => {
        resolveChangeWait = resolve;
      });
      const subscription = reaction(
        () => sut.fields.age?.error,
        () => {
          resolveChangeWait(true);
        }
      );
      model.setAge(12);
      await waitForChange;
      expect(sut.fields.age?.error).toBeTruthy();
      subscription();
    });

    it('re-validates reactively on value change while validation on progress', async () => {
      model.setEmail('test@test.com');
      sut.setEnable(true); // invalid age
      const isValid = sut.isValid();
      model.setAge(1); // invalid while in progress
      model.setAge(2); // invalid while in progress
      model.setAge(3); // invalid while in progress
      await expect(isValid).resolves.toBe(false);
      // setup age change subscription
      let resolveChangeWait: (value: boolean) => void;
      const waitForChange = new Promise((resolve) => {
        resolveChangeWait = resolve;
      });
      const subscription = reaction(
        () => sut.fields.age?.error,
        (val) => {
          // wait error clear when age is 18
          if (!val) {
            resolveChangeWait(true);
          }
        }
      );
      model.setAge(4);
      model.setAge(5);
      model.setAge(18);
      await waitForChange;
      subscription();
      expect(sut.fields.age?.error).toBeFalsy();
      expect(sut.fields.email?.error).toBeFalsy();
    });

    it('trigger hasErrors if a validation is in progress', async () => {
      model.setEmail('test@test.com');
      model.setAge(18);
      sut.setEnable(true); // all valid at this point
      const isValid = sut.isValid();
      model.setAge(1); // set invalid age while in progress
      expect(sut.hasErrors).toBeTruthy();
      await expect(isValid).resolves.toBe(true);
    });

    it('re-validates on isValid only when needed (specially remote validation)', async () => {
      expect(remoteValidationMock).not.toHaveBeenCalled();
      sut.setEnable(true);
      await expect(sut.isValid()).resolves.toBe(false);
      // should have been called initial time when all fields validation run
      expect(remoteValidationMock).toHaveBeenCalledTimes(1);
      model.setAge(18);
      await expect(sut.isValid()).resolves.toBe(false);
      // should not run remote validation on a different field change
      expect(remoteValidationMock).toHaveBeenCalledTimes(1);
      model.setEmail('not valid');
      await expect(sut.isValid()).resolves.toBe(false);
      // should run remote validation if the email field changes
      expect(remoteValidationMock).toHaveBeenCalledTimes(2);
    });

    it('validates arrays and gets individual errors', async () => {
      model.setAge(18);
      model.setEmail('test@test.com');
      model.setOtherEmails(['valid@test.com']);
      sut.setEnable(true);
      await expect(sut.isValid()).resolves.toBe(true);
      model.setOtherEmails([
        'valid@test.com',
        'not-valid',
        'also-valid@test.com',
        'also-not-valid',
        '',
      ]);
      await expect(sut.isValid()).resolves.toBe(false);
      expect(sut.hasErrors).toBe(true);
      const otherEmailsField = sut.fields.otherEmails;
      expect(otherEmailsField?.error).toBeTruthy();
      expect(otherEmailsField?.getArrayErrorAt(0)).toBeUndefined();
      expect(otherEmailsField?.getArrayErrorAt(1)).toEqual(otherEmailsValid);
      expect(otherEmailsField?.getArrayErrorAt(2)).toBeUndefined();
      expect(otherEmailsField?.getArrayErrorAt(3)).toEqual(otherEmailsValid);
      expect(otherEmailsField?.getArrayErrorAt(4)).toEqual(otherEmailsRequired);
      expect(otherEmailsField?.getArrayErrorAt(9)).toBeUndefined();
    });
  });

  describe('Remote validation failure', () => {
    beforeEach(() => {
      // model setup to fail email remote validation
      model = new ModelTest();
      adapter = new YupAdapter(getValidationSchema(false));
      sut = new Validation(model, adapter);
    });
    it('fails validation on remote validation failure', async () => {
      model.setAge(18); // valid age
      model.setEmail('test@test.com'); // valid local validation
      sut.setEnable(true);
      await expect(sut.isValid()).resolves.toBe(false);
      const fields = sut.fields;
      expect(fields.email?.error).toEqual('email is already in use'); // message from custom validator above
      expect(fields.age?.error).toBeFalsy();
      expect(sut.hasErrors).toBeTruthy();
    });
  });
});

type ValidationGroupKeys = 'first' | 'second';

describe('Validation Group', () => {
  let validations: Record<ValidationGroupKeys, Validation<ModelTest>>;
  let firstModel: ModelTest;
  let secondModel: ModelTest;
  let sut: ValidationGroup<ValidationGroupKeys, ModelTest>;
  const adapter = new YupAdapter(getValidationSchema());

  beforeEach(() => {
    firstModel = new ModelTest();
    secondModel = new ModelTest();
    validations = {
      first: new Validation(firstModel, adapter),
      second: new Validation(secondModel, adapter),
    };
    sut = new ValidationGroup(validations);
  });

  it('validates group with `isValid` and sets errors', async () => {
    let firstFields: ValidationFields<ModelTest>;
    let secondFields: ValidationFields<ModelTest>;
    await expect(sut.isValid()).resolves.toBe(true);
    firstFields = sut.item.first.fields;
    secondFields = sut.item.second.fields;
    expect(firstFields.email?.error).toBeFalsy();
    expect(firstFields.age?.error).toBeFalsy();
    expect(sut.item.first.hasErrors).toBeFalsy();
    expect(secondFields.email?.error).toBeFalsy();
    expect(secondFields.age?.error).toBeFalsy();
    expect(sut.item.second.hasErrors).toBeFalsy();

    sut.setEnable(true);
    await expect(sut.isValid()).resolves.toBe(false);
    firstFields = sut.item.first.fields;
    secondFields = sut.item.second.fields;
    expect(firstFields.email?.error).toBeTruthy();
    expect(firstFields.age?.error).toBeTruthy();
    expect(secondFields.email?.error).toBeTruthy();
    expect(secondFields.age?.error).toBeTruthy();
    expect(sut.hasErrors).toBeTruthy();

    firstModel.setEmail('test@test.com');
    firstModel.setAge(18);
    await expect(sut.isValid()).resolves.toBe(false);
    firstFields = sut.item.first.fields;
    secondFields = sut.item.second.fields;
    expect(firstFields.email?.error).toBeFalsy();
    expect(firstFields.age?.error).toBeFalsy();
    expect(secondFields.email?.error).toBeTruthy();
    expect(secondFields.age?.error).toBeTruthy();
    expect(sut.hasErrors).toBeTruthy();

    secondModel.setEmail('test@test.com');
    secondModel.setAge(18);
    await expect(sut.isValid()).resolves.toBe(true);
    firstFields = sut.item.first.fields;
    secondFields = sut.item.second.fields;
    expect(firstFields.email?.error).toBeFalsy();
    expect(firstFields.age?.error).toBeFalsy();
    expect(secondFields.email?.error).toBeFalsy();
    expect(secondFields.age?.error).toBeFalsy();
    expect(sut.hasErrors).toBeFalsy();
  });
});
