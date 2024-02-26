export function assert<T>(value: T, message?: string): NonNullable<T> {
  if (!value) {
    throw new Error(message ?? `Assertion failed: ${value}`);
  }
  return value;
}

/** Similar to assert, but passes for falsey types like 0 and empty string */
export function assertNotNull<T>(value: T, message?: string): NonNullable<T> {
  if (value == null) {
    throw new Error(message ?? `Assertion failed: ${value}`);
  }
  return value;
}
