// Serializes a value to JSON, converting BigInts to strings and recursing into arrays and objects. This is useful for sending data to the client that may contain BigInts, which are not supported by JSON.stringify.
export function toSerializable(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const { toObject } = value as unknown as { toObject?: () => unknown };
    if (typeof toObject === "function") {
      try {
        return toSerializable(toObject.call(value));
      } catch {
        
      }
    }

    return value.map(toSerializable);
  }

  if (value && typeof value === "object") {
    const { toJSON } = value as { toJSON?: () => unknown };
    if (typeof toJSON === "function") {
      return toJSON.call(value);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toSerializable(entry)]),
    );
  }

  return value;
}
