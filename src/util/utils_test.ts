import {countBits, reverseBits} from './utils.js';

describe('reverseBits', () => {
  it('reverses bits', () => {
    expect(reverseBits(0b11011001)).toBe(0b10011011 << 24);
    expect(reverseBits(-2)).toBe(0x7fffffff);
    expect(reverseBits(1)).toBe(0x80000000 >> 0);
    expect(reverseBits(0x00996600)).toBe(0x00669900);
  });
});
describe('countBits', () => {
  it('counts bits', () => {
    expect(countBits(0)).toBe(0);
    expect(countBits(0xffffffff)).toBe(32);
    expect(countBits(0b1001011010001)).toBe(6);
    expect(countBits(0xcafebabe)).toBe(22);
  });
});
