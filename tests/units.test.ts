import { describe, expect, it } from 'vitest';
import { formatFeetInches, formatFraction, formatInches, parseLength } from '../src/model';

describe('formatFraction', () => {
  it.each([
    [23.625, '23 5/8'],
    [0.5, '1/2'],
    [24, '24'],
    [23.99, '24'],
    [-1.5, '-1 1/2'],
    [0, '0'],
    [0.01, '0'],
    [10.0625, '10 1/16'],
  ])('%s -> %s', (x, s) => expect(formatFraction(x)).toBe(s));

  it('uses the requested precision', () => {
    expect(formatFraction(23 / 32, 32)).toBe('23/32');
    expect(formatFraction(23 / 32, 16)).toBe('3/4');
  });

  it('adds an inch mark', () => expect(formatInches(23.625)).toBe('23 5/8″'));
});

describe('formatFeetInches', () => {
  it.each([
    [142.375, '11′ 10 3/8″'],
    [144, '12′ 0″'],
    [11.97, '1′ 0″'],
    [10.375, '10 3/8″'],
    [167.99, '14′ 0″'],
  ])('%s -> %s', (x, s) => expect(formatFeetInches(x)).toBe(s));
});

describe('parseLength', () => {
  it.each([
    ['23 5/8', 23.625],
    ['23-5/8', 23.625],
    ['23.625', 23.625],
    ['5/8', 0.625],
    ['.5', 0.5],
    ['142', 142],
    ['142in', 142],
    ['142 inches', 142],
    ['23 5/8"', 23.625],
    ["12'", 144],
    ["11' 10 3/8\"", 142.375],
    ["11'-10 3/8", 142.375],
    ['11′ 10 3/8″', 142.375],
    ['11ft 6in', 138],
    ['11 ft', 132],
    ['  24  ', 24],
  ])('%j -> %s', (s, x) => expect(parseLength(s)).toBeCloseTo(x, 9));

  it.each(['', 'abc', '1/0', '5/8/3', '12 x 4', '-3', "11' 2' 3"])('rejects %j', (s) => {
    expect(parseLength(s)).toBeNull();
  });
});
