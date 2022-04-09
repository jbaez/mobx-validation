# mobx-validation

Validates models with observables. Runs the validation automatically on a field when it changes.

# Usage (example using included Yup adapter)
(for using Yup adapter, "yup": "^1.0.0-beta.1" needs to be installed)

```typescript

class ModelTest {
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
  /**
   * Set email
   * @param {string} email Email
   */
  setEmail(email: string) {
    this.email = email;
  }

  /**
   * Set age
   * @param {number} age Age
   */
  setAge(age: number) {
    this.age = age;
  }
}

const schema = yup.object({
  email: string()
    .email()
    .required(),
  age: number().min(18).integer().required(),
});
const adapter = new YupAdapter(getValidationSchema());
const validation = new Validation(model, adapter);

// until validation is not enabled it is considered valid (to be used on submit)
validation.setEnable(true);

validation.fields.email.error // error message
validation.fields.age.error // error message
validation.hasErrors // true;
```