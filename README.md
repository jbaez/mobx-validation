# mobx-validation

Validates models with observables. Runs the validation automatically on a field when it changes.

# Usage (example using included Yup adapter)
(for using Yup adapter, "yup": "^1.0.0-beta.1" needs to be installed)

```typescript
import { Validation, YupAdapter } from 'mobx-validation';
```

```typescript
class ModelTest {
  email = '';
  age = 16;
  otherEmails: string= [];
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
const model = new ModelTest();
const schema = yup.object({
  email: string()
    .email()
    .required(),
  age: number().min(18).integer().required(),
  otherEmails: array().of(string().required().email()),
});
const adapter = new YupAdapter(schema);
const validation = new Validation(model, adapter);

model.setEmail('invalid-email');
model.setAge(0);
model.setOtherEmails([
  'valid@email.com',
  'invalid-email'
])

// until validation is not enabled it is considered valid.
await validation.isValid();
validation.hasErrors // false;
// Set validation enabled (to be used on submit)
validation.setEnable(true);
await validation.isValid();
validation.hasErrors // true;
validation.fields.email.error // error message
validation.fields.age.error // error message
validation.fields.otherEmails.error // error message
validation.fields.otherEmails.getArrayErrorAt(0) // undefined
validation.fields.otherEmails.getArrayErrorAt(1) // second item error message
```
The adapter can also be configured globally with either an adapter instance or a factory.
Example using a factory:

```typescript
import { Validation, YupAdapter } from 'mobx-validation';
```

```typescript

interface SelfValidatable {
  getValidation: () => ObjectSchema<unknown>;
}

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

const factory: ValidationAdapterFactory = (model) => {
  return new YupAdapter((model as SelfValidatable).getValidation());
};

configure({
  adapter: factory,
});

const model = new ModelTest();
const sut = new Validation(model);
```