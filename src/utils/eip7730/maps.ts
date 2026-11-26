import {
  isMapRef,
  own,
  type Eip7730DisplayFormat,
  type Eip7730MapRef,
  type Eip7730MapValue,
} from './zip';

export type MapKeysAt = (path: string) => (string | null)[];

function resolveMapRef(
  format: Eip7730DisplayFormat,
  ref: Eip7730MapRef,
  keysAt: MapKeysAt,
): Eip7730MapValue | undefined {
  const values =
    ref.map && format.metadata?.maps
      ? own(format.metadata.maps, ref.map)
      : undefined;
  if (!values || !ref.keyPath) return undefined;
  // One value serves the whole format, so an array giving a key per element names none.
  const [key, ...more] = keysAt(ref.keyPath);
  return key != null && more.length === 0
    ? own(values, key.toLowerCase())
    : undefined;
}

// Null rejects the entry: the spec makes a descriptor invalid for a request whose key has no match.
export function withMapValues(
  format: Eip7730DisplayFormat,
  keysAt: MapKeysAt,
): Eip7730DisplayFormat | null {
  const refers = format.fields.some(field =>
    Object.values(field.params ?? {}).some(isMapRef),
  );
  if (!refers) return format;
  const fields = [];
  for (const field of format.fields) {
    if (!field.params) {
      fields.push(field);
      continue;
    }
    const params: [string, unknown][] = [];
    for (const [key, value] of Object.entries(field.params)) {
      const resolved = isMapRef(value)
        ? resolveMapRef(format, value, keysAt)
        : value;
      if (resolved === undefined) return null;
      params.push([key, resolved]);
    }
    fields.push({ ...field, params: Object.fromEntries(params) });
  }
  return { ...format, fields };
}
