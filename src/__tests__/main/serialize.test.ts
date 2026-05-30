import { describe, expect, it } from 'vitest';
import { deserialize, isPrimitive, serialize } from '@/shared/utils/serialize';

describe('isPrimitive', () => {
  it('should return true for null', () => {
    expect(isPrimitive(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isPrimitive(undefined)).toBe(true);
  });

  it('should return true for primitives', () => {
    expect(isPrimitive('string')).toBe(true);
    expect(isPrimitive(42)).toBe(true);
    expect(isPrimitive(true)).toBe(true);
    expect(isPrimitive(Symbol('test'))).toBe(true);
    expect(isPrimitive(123n)).toBe(true);
  });

  it('should return false for objects', () => {
    expect(isPrimitive({})).toBe(false);
    expect(isPrimitive([])).toBe(false);
    expect(isPrimitive(() => {})).toBe(false);
  });
});

describe('serialize', () => {
  it('should serialize null', () => {
    expect(serialize(null)).toBe('null');
  });

  it('should serialize undefined', () => {
    expect(serialize(undefined)).toBe('undefined');
  });

  it('should serialize string', () => {
    expect(serialize('hello')).toBe('hello');
  });

  it('should serialize number', () => {
    expect(serialize(42)).toBe('42');
  });

  it('should serialize boolean', () => {
    expect(serialize(true)).toBe('true');
    expect(serialize(false)).toBe('false');
  });

  it('should serialize NaN', () => {
    expect(serialize(NaN)).toBe('NaN');
  });

  it('should serialize Infinity', () => {
    expect(serialize(Infinity)).toBe('Infinity');
    expect(serialize(-Infinity)).toBe('-Infinity');
  });

  it('should serialize object', () => {
    expect(serialize({ a: 1 })).toBe('{"a":1}');
  });

  it('should serialize array', () => {
    expect(serialize([1, 2, 3])).toBe('[1,2,3]');
  });

  it('should serialize Error', () => {
    const error = new Error('test error');
    const result = serialize(error);
    const parsed = JSON.parse(result);
    expect(parsed.message).toBe('test error');
    expect(parsed.__type).toBe('Error');
  });

  it('should serialize function', () => {
    const result = serialize(function myFunc() {});
    expect(result).toContain('[Function myFunc]');
  });

  it('should serialize anonymous function', () => {
    const result = serialize(() => {});
    expect(result).toBe('"[Function]"');
  });
});

describe('deserialize', () => {
  it('should deserialize null', () => {
    expect(deserialize('null')).toBe(null);
  });

  it('should deserialize undefined', () => {
    expect(deserialize('undefined')).toBe(undefined);
  });

  it('should deserialize boolean', () => {
    expect(deserialize('true')).toBe(true);
    expect(deserialize('false')).toBe(false);
  });

  it('should deserialize NaN', () => {
    expect(deserialize('NaN')).toBe(NaN);
  });

  it('should deserialize Infinity', () => {
    expect(deserialize('Infinity')).toBe(Infinity);
    expect(deserialize('-Infinity')).toBe(-Infinity);
  });

  it('should deserialize number string', () => {
    expect(deserialize('42')).toBe(42);
  });

  it('should deserialize object', () => {
    const result = deserialize<{ a: number }>('{"a":1}');
    expect(result).toEqual({ a: 1 });
  });

  it('should deserialize array', () => {
    const result = deserialize<number[]>('[1,2,3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('should deserialize Error', () => {
    const error = deserialize<Error>('{"__type":"Error","message":"test error","stack":"stack"}');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('test error');
  });

  it('should deserialize plain string', () => {
    expect(deserialize('hello')).toBe('hello');
  });
});

describe('serialize/deserialize roundtrip', () => {
  it('should roundtrip primitives', () => {
    expect(deserialize(serialize(null))).toBe(null);
    expect(deserialize(serialize(undefined))).toBe(undefined);
    expect(deserialize(serialize(true))).toBe(true);
    expect(deserialize(serialize(42))).toBe(42);
    expect(deserialize(serialize('hello'))).toBe('hello');
  });

  it('should roundtrip objects', () => {
    const obj = { a: 1, b: 'test', c: null };
    expect(deserialize(serialize(obj))).toEqual(obj);
  });

  it('should roundtrip arrays', () => {
    const arr = [1, 2, { a: 3 }];
    expect(deserialize(serialize(arr))).toEqual(arr);
  });
});
