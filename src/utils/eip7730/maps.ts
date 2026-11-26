import { firstArraySelector } from './arrays';
import {
  isMapRef,
  own,
  type Eip7730DisplayFormat,
  type Eip7730MapRef,
  type Eip7730MapValue,
} from './zip';

export type MapKeyAt = (path: string) => string | null;

function resolveMapRef(
  format: Eip7730DisplayFormat,
  ref: Eip7730MapRef,
  keyAt: MapKeyAt,
): Eip7730MapValue | undefined {
  // A key read from an array has no single value for the whole format.
  if (!ref.map || !ref.keyPath || firstArraySelector(ref.keyPath)) {
    return undefined;
  }
  const values = format.metadata?.maps && own(format.metadata.maps, ref.map);
  const key = values ? keyAt(ref.keyPath) : null;
  return values && key !== null ? own(values, key.toLowerCase()) : undefined;
}

// Null rejects the entry: the spec makes a descriptor invalid for a request whose key has no match.
export function withMapValues(
  format: Eip7730DisplayFormat,
  keyAt: MapKeyAt,
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
        ? resolveMapRef(format, value, keyAt)
        : value;
      if (resolved === undefined) return null;
      params.push([key, resolved]);
    }
    fields.push({ ...field, params: Object.fromEntries(params) });
  }
  return { ...format, fields };
}
