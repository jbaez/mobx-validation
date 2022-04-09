import { Validatable, ValidationAdapter, ValidationError } from '../validation';
import { ObjectSchema, ValidationError as ValidationErrorYup } from 'yup';

export class YupAdapter implements ValidationAdapter {
  private readonly _schema: ObjectSchema<object>;
  private _errorInit = false;

  constructor(schema: ObjectSchema<object>) {
    this._schema = schema;
  }

  validate(model: Validatable, property: string): Promise<ValidationError> {
    return new Promise((resolve, reject) => {
      this._schema
        .validateAt(property, model, {
          abortEarly: this._errorInit,
        })
        .then(() => {
          resolve(undefined);
        })
        .catch((error: ValidationErrorYup) => {
          if (model[property] !== error.value) {
            reject();
            return;
          }
          resolve(error.message);
        })
        .finally(() => {
          this._errorInit = true;
        });
    });
  }

  getFields(): string[] {
    return Object.keys(this._schema.fields);
  }
}
