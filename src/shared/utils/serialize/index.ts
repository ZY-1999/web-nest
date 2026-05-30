export function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  );
}

export function serialize(value: unknown): string {
  // Use toString() for primitive types
  if (isPrimitive(value)) {
    return String(value);
  }

  // Use JSON.stringify for all other types (existing behavior)
  return JSON.stringify(value, (key, val) => {
    if (val instanceof Error) {
      return { __type: val.name, ...val, message: val.message, stack: val.stack };
    }
    if (typeof val === 'function') {
      return val.name ? `[Function ${val.name}]` : '[Function]';
    }
    if (val === undefined) {
      return 'undefined';
    }
    return val;
  });
}

export function deserialize<T = unknown>(value: string): T {
  // Handle primitive strings that were serialized with String()
  if (value === 'null') {
    return null as T;
  }
  if (value === 'undefined') {
    return undefined as T;
  }
  if (value === 'true') {
    return true as T;
  }
  if (value === 'false') {
    return false as T;
  }
  if (value === 'NaN') {
    return NaN as T;
  }
  if (value === 'Infinity') {
    return Infinity as T;
  }
  if (value === '-Infinity') {
    return -Infinity as T;
  }

  // Try to parse as JSON
  try {
    return JSON.parse(value, (_k, v) => {
      // Restore Error objects
      if (v && typeof v.__type === 'string' && v.message !== undefined) {
        const error = new Error(v.message) as Error & Record<string, unknown>;
        error.name = v.__type;
        error.stack = v.stack;
        // Copy other enumerable properties
        for (const key of Object.keys(v)) {
          if (key !== '__type' && key !== 'message' && key !== 'stack') {
            error[key] = v[key];
          }
        }
        return error;
      }
      // Restore undefined serialized as string
      if (v === 'undefined') {
        return undefined;
      }
      // Restore function placeholders
      if (typeof v === 'string' && v.startsWith('[Function')) {
        return v;
      }
      return v;
    }) as T;
  } catch {
    // Not valid JSON, return as-is (likely a plain string)
    return value as T;
  }
}
