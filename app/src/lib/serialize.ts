// Prisma returns BigInt for on-chain amounts and JSON.stringify throws on those,
// so anything leaving the server as JSON has to go through here first.
export function toSerializable(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === "object") {
    // Date and Prisma Decimal define toJSON; recursing into them yields {} instead.
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
