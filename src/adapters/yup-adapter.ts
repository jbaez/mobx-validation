import {
  Validatable,
  ValidationAdapter,
  ValidationError,
  ValidationArrayError,
} from '../validation';
import { ObjectSchema, ValidationError as ValidationErrorYup } from 'yup';

/**
 * Fill empty positions in validationErrors before `index` argument with null
 */
function fillIndexes(validationErrors: ValidationArrayError, index: number) {
  if (index < 1) {
    return;
  }
  for (let i = 0; i < index; i++) {
    if (typeof validationErrors[i] == 'undefined') {
      validationErrors[i] = null;
    }
  }
}

/**
 * Constructs the ValidationError from ValidationErrorYup error
 */
function getError(
  error: ValidationErrorYup,
  property: string
): ValidationError {
  const message = error.message;
  const errors = error.errors;
  if (errors.length == 0) {
    return message;
  }
  const regex = new RegExp(`^${property}\\[(.*)\\].*$`);
  const result = regex.exec(errors[0]);
  if (result && result.length) {
    const validationErrors: ValidationArrayError = error.errors.reduce(
      (valErrors, errorItem) => {
        const result = regex.exec(errorItem);
        if (result && result.length > 1) {
          const index = parseInt(result[1], 10);
          fillIndexes(valErrors, index);
          valErrors[index] = errorItem;
        }
        return valErrors;
      },
      [] as ValidationArrayError
    );
    return validationErrors;
  } else {
    return message;
  }
}

export class YupAdapter implements ValidationAdapter {
  private readonly _schema: ObjectSchema<object>;

  constructor(schema: ObjectSchema<object>) {
    this._schema = schema;
  }

  validate(model: Validatable, property: string): Promise<ValidationError> {
    return new Promise((resolve, reject) => {
      this._schema
        .validateAt(property, model, {
          abortEarly: false,
        })
        .then(() => {
          resolve(undefined);
        })
        .catch((error: ValidationErrorYup) => {
          if (model[property] !== error.value) {
            reject();
            return;
          }
          resolve(getError(error, property));
        });
    });
  }

  getFields(): string[] {
    return Object.keys(this._schema.fields);
  }
}
