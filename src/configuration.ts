import { ValidationAdapter, Validatable } from './validation';

export type ValidationAdapterFactory = (
  model: Validatable
) => ValidationAdapter;

type AdapterConfiguration = ValidationAdapter | ValidationAdapterFactory;

interface Configuration {
  adapter?: AdapterConfiguration;
}

let _adapter: AdapterConfiguration | undefined;

function isAdapterFactory(
  adapter: AdapterConfiguration
): adapter is ValidationAdapterFactory {
  return typeof adapter == 'function';
}

/**
 * Configures validation globally
 */
export function configure(config: Configuration) {
  if (config.adapter) {
    _adapter = config.adapter;
  }
}

/**
 * Resets configuration
 */
export function reset() {
  _adapter = undefined;
}

/**
 * Returns the configured adapter instance
 */
export function getAdapter(model: Validatable): ValidationAdapter {
  if (!_adapter) {
    throw 'Validation has not been configured with an adapter. Use `configure`';
  }
  if (isAdapterFactory(_adapter)) {
    return _adapter(model);
  }
  return _adapter;
}
