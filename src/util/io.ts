import {assert} from './assert.js';
import {IterType, asIterator, countBits} from './utils.js';

export type Bit = 0 | 1;

/** A generic Reader for a specified type. */
export interface Reader<T, M = T extends Bit ? number : T[]> {
  /**
   * @return a single item from the stream.
   * @throws If this stream is closed, or if there was an error generating the
   *    value.
   */
  read(): T;

  /**
   * @return A batch of items.
   * @throws if `itemCount` exceeds  `maxBatchSize`, or if it is negative.
   */
  readBatch(itemCount?: number): M;

  /**
   * @return the max supported batch size.
   */
  maxBatch(): number;

  /**
   * @return The number of items that are immediately available from this
   *    stream. This will be at least '1' for any stream that is not closed,
   *    and will never exceed `count` if count is known. Typically, this will
   *    return the number of items that is the most efficient to be passed into
   *    readBatch(). Unless the stream is closed, it should never be an error to
   *    call `readBatch(pending())`, and it should always return at least one
   *    item.
   */
  pending(): number;

  /**
   * @return The number of items remaining in this stream, if known, or a
   *    negative value if not known.
   */
  count(): number;

  /**
   * @return `true` if this stream is closed.
   */
  isClosed(): boolean;

  /**
   * Close this stream.
   */
  close(): void;
}

/**
 * A generic Writer for a specified type.
 */
export interface Writer<T, M = T extends Bit ? number : T[]> {
  /**
   * Write a single value to the stream.
   *
   * @throws If this stream is closed, or if there was an error generating the
   *    value.
   */
  write(value: T): this;

  /**
   * Write a batch of items.
   *
   * @param batch The batch of items to write
   * @param itemCount The number of items to write from that batch. If not set,
   *    all items are written.
   *
   * @throws if the batch size exceeds  `maxBatchSize`, or if it is negative.
   */
  writeBatch(batch: M, itemCount?: number): this;

  /**
   * @return `true` if this stream is closed.
   */
  isClosed(): boolean;

  /**
   * Close this stream.
   */
  close(): void;
}

export interface BitReader extends Reader<Bit> {
  asBigBitReader(): BigBitReader;
}
export interface BigBitReader extends Reader<Bit, bigint> {
  asBitReader(): BitReader;
}
export interface BitWriter extends Writer<Bit> {
  asBigBitWriter(): BigBitWriter;
}
export interface BigBitWriter extends Writer<Bit, bigint> {
  asBitWriter(): BitWriter;
}

/** Use a Reader object as an Iterator of bits */
export function* biterator(input: BitReader): Generator<Bit> {
  yield* iterator(input) as Generator<Bit>;
}

/** Use a Reader object as an Iterator of bytes */
export function* byterator(input: BitReader): Generator<number> {
  yield* interator(input, 8);
}

/** Use a Reader object as an Iterator of bits */
export function* interator(
  input: BitReader,
  bitsPerVal = 32,
): Generator<number> {
  assert(bitsPerVal > 0 && bitsPerVal <= 32, 'Bit count must be > 0 and <= 32');
  while (!input.isClosed()) {
    const bitsRemaining = input.count();
    yield input.readBatch(
      bitsRemaining < 0 || bitsRemaining >= bitsPerVal
        ? bitsPerVal
        : bitsRemaining,
    );
  }
}

export function* iterator<T>(reader: Reader<T>): Generator<T> {
  while (!reader.isClosed()) {
    yield reader.read();
  }
}

class EmptyReader implements Reader<unknown, unknown> {
  read(): Bit {
    throw new Error('End of stream');
  }

  readBatch(): unknown {
    throw new Error('End of stream');
  }

  maxBatch(): number {
    return 1;
  }

  readBigBits(): unknown {
    throw new Error('End of stream');
  }

  count(): number {
    return 0;
  }

  pending(): number {
    return 0;
  }

  close(): void {}

  isClosed(): boolean {
    return true;
  }
}

/** An efficient empty reader */
export const EMPTY_READER = new EmptyReader();

/**
 * BitSet is conceptually an infinite (well, up to the max index into a
 * JavaScript array) series of bits, all initialized to zero. It has abilities
 * to read and set bits, either individually or in groups using numbers,
 * bigints, and other bitsets.
 */
export class BitSet implements Iterable<Bit> {
  // a series of 32-bit values holding the bits.
  readonly bits: number[];

  // Backing value for the length property
  private _length = 0;

  constructor();
  constructor(bits: number, bitCount?: number);
  constructor(bits: number[], bitCount?: number);
  constructor(bits?: number[] | number, bitCount?: number) {
    this.bits = Array.isArray(bits) ? bits : bits ? [bits] : [];
    this._length = this.bits.length * 32;
    if (bitCount !== undefined && bitCount !== this._length) {
      this.length = bitCount;
    }
  }

  static fromBigint(value: bigint) {
    const result = new BitSet();
    result.setBigBits(value, 0);
    return result;
  }

  static fromReader(reader: BitReader, bitCount?: number): BitSet {
    if (reader instanceof BitSetReader) {
      reader.close();
      return reader.bitset;
    }
    bitCount = bitCount ?? -1;
    const result = new BitSet();
    const writer = result.toWriter();

    function getBitsToWrite() {
      return bitCount! < 0
        ? reader.pending()
        : bitCount! > 0
          ? Math.min(bitCount!, reader.pending())
          : 0;
    }
    let bitsToWrite = getBitsToWrite();
    while (bitsToWrite) {
      writer.writeBatch(reader.readBatch(bitsToWrite), bitsToWrite);
      bitCount -= bitsToWrite;
      bitsToWrite = getBitsToWrite();
    }
    return result;
  }

  /** The length of this  */
  get length(): number {
    return this._length;
  }

  set length(val: number) {
    assert(val >= 0, 'Length must be positive');

    const numbersNeeded = (val + 31) >>> 5;

    if (numbersNeeded > this.bits.length) {
      for (let i = this.bits.length; i < numbersNeeded; i++) {
        this.bits.push(0);
      }
    } else {
      // resize the bits buffer
      this.bits.length = numbersNeeded;
      if (val < this._length) {
        // zero out any extra bits in the last buffer position
        this.bits[this.bits.length - 1] &= 0xffffffff >>> -(val & 0b11111);
      }
    }

    this._length = val;
  }

  /**
   * Reduce the length such that all high-order zeros are dropped.
   */
  trim(): this {
    // find last non-zero buffer value
    let i: number;
    for (i = this.bits.length; i > 0 && !this.bits[i - 1]; --i);
    this.bits.length = i;

    this._length = this.bits.length
      ? (this.bits.length << 5) - Math.clz32(this.bits[this.bits.length - 1])
      : 0;

    return this;
  }

  getBit(index: number): Bit {
    assert(index >= 0, 'Index out of range');
    if (index >= this._length) return 0;
    const {bytePos, bitPos} = getPosition(index);
    return ((this.bits[bytePos] >>> bitPos) & 1) as Bit;
  }

  setBit(index: number, val: Bit = 1): void {
    assert(index >= 0, 'Index out of range');
    if (this._length <= index) {
      // use 'length' not '_length' to get the side effects
      this.length = index + 1;
    }
    const {bytePos, bitPos} = getPosition(index);
    const mask = 1 << bitPos;
    if (val) {
      this.bits[bytePos] |= mask;
    } else {
      this.bits[bytePos] &= ~mask;
    }
  }

  appendBit(val: Bit = 1): void {
    this.setBit(this._length, val);
  }

  clearBit(index: number): void {
    this.setBit(index, 0);
  }

  getBits(start: number, end?: number): number {
    end = end ?? start + 32;
    assert(start >= 0 && end >= start, 'start or end out of range');
    assert(end - start <= 32, 'Too many bits requested - use getBigBits');

    if (start >= this._length) {
      // out of bit range
      return 0;
    }
    end = Math.min(end, this._length);
    const bitCount = end - start;
    if (bitCount === 0) {
      return 0;
    }
    const {bytePos, bitPos} = getPosition(start);
    if (bitPos === 0 && bitCount === 32) {
      // performance short circuit
      return this.bits[bytePos];
    }
    if (bitPos + bitCount <= 32) {
      return (this.bits[bytePos] >>> bitPos) & (0xffffffff >>> -bitCount);
    } else {
      // combine the two bytes, shifted and masked to include the requested bits
      return (
        ((this.bits[bytePos] >>> bitPos) |
          (this.bits[bytePos + 1] << -bitPos)) &
        (0xffffffff >>> -bitCount)
      );
    }
  }

  setBits(val: number, start: number, end?: number): void {
    end = end ?? start + 32;
    assert(start >= 0 && end >= start, 'start or end out of range');
    assert(end - start <= 32, 'setting bits limited to 32 bits');
    // normalize val into a positive 2's compliment integer
    if (end === undefined) {
      end = start + 32;
    }
    // ensure we have space in the buffer
    if (end >= this._length) {
      this.length = end;
    }

    const bitCount = end - start;
    if (bitCount === 0) {
      // nothing to do
      return;
    }
    const {bytePos, bitPos} = getPosition(start);

    if (bitPos + bitCount <= 32) {
      const mask = (0xffffffff >>> -bitCount) << bitPos;
      // single buffer
      this.bits[bytePos] =
        (this.bits[bytePos] & ~mask) | ((val << bitPos) & mask);
    } else {
      this.bits[bytePos] =
        (this.bits[bytePos] & (0xffffffff >>> -bitPos)) | (val << bitPos);
      const mask = 0xffffffff << (bitPos + bitCount);
      this.bits[bytePos + 1] =
        (this.bits[bytePos + 1] & mask) | ((val >> -bitPos) & ~mask);
    }
  }

  appendBits(val: number | bigint, bitCount?: number): void {
    if (typeof val === 'bigint') {
      this.appendBigBits(val, bitCount);
      return;
    }
    bitCount = bitCount ?? 32;
    assert(
      bitCount >= 0 && bitCount <= 32,
      'bitCount must be between 0 and 32',
    );
    return this.setBits(val, this._length, this._length + bitCount);
  }

  getBigBits(start: number, end?: number): bigint {
    end = end ?? Math.max(start, this._length);
    assert(start >= 0 && end >= start, 'start or end out of range');

    if (start >= this._length) {
      // out of bit range
      return 0n;
    }
    end = Math.min(end, this._length);
    const bitCount = end - start;
    if (bitCount === 0) {
      return 0n;
    }
    const {bytePos, bitPos} = getPosition(start);
    if (bitPos + bitCount <= 32) {
      // short circuit for single buffer
      return BigInt(
        ((this.bits[bytePos] >>> bitPos) & (0xffffffff >>> -bitCount)) >>> 0,
      );
    }
    const bigBitCount = BigInt(bitCount);
    let result = BigInt(this.bits[bytePos] >>> bitPos);
    let bitLen = 32 - bitPos;
    let i = bytePos + 1;
    for (; bigBitCount > 32 + bitLen; i++) {
      result |= BigInt(this.bits[i] >>> 0) << BigInt(bitLen);
      bitLen += 32;
    }
    // mask the last value
    result |=
      BigInt((this.bits[i] & (0xffffffff >>> (bitLen - bitCount))) >>> 0) <<
      BigInt(bitLen);
    return result;
  }

  /**
   * Set the bits from a bigint source.
   *
   * @param start The position in this BitSet where bits will be copied to.
   * @param end The end position to stop writing bits. If end is set larger
   * than the size of the bigint, the bigint will be sign-extended to fill the
   * remaining space.
   *
   * If not specified (or negative), then all bit information in val will be
   * used, growing the size of this BitSet as needed. If there was remaining
   * space, then it will be filled with the sign of val.
   *
   * Returns the number of bits written.
   */
  setBigBits(val: bigint, start: number, end?: number): number {
    assert(
      start >= 0 && (end === undefined || end >= start),
      'start or end out of range',
    );

    if (start === end) {
      // nothing to do
      return 0;
    }

    const firstStart = start;
    if (end) {
      // mask off the parts of val that we won't be using
      val &= (1n << BigInt(end - start)) - 1n;
      this.length = Math.max(this._length, end);
    }

    let {bytePos, bitPos} = getPosition(start);
    // shift val to line up with bitPos
    val <<= BigInt(bitPos);
    const neg = val < 0;
    if (neg) {
      val = ~val;
    }
    let mask = (0xffffffff << bitPos) >>> 0;
    start += 32 - bitPos;
    if (val <= mask) {
      // the contents of val fit within the first buffer
      // if end isn't defined, let's figure it out here
      if (!end) {
        end = Math.max(start - Math.clz32(Number(val)), this._length);
        this.length = Math.max(this._length, end);
      }
      if (end <= start) {
        // writing a single byte buffer
        mask = (mask << -end) >>> -end;
        this.bits[bytePos] =
          (this.bits[bytePos] & ~mask) | (Number(neg ? ~val : val) & mask);
        return end - firstStart;
      }
    }
    bitPos = 0;
    this.length = Math.max(this._length, start);
    this.bits[bytePos] =
      (this.bits[bytePos] & ~mask) | Number((neg ? ~val : val) & BigInt(mask));

    val >>= 32n;
    bytePos++;
    while (
      end ? end - start > 32 : this._length - start > 32 || val > 0xffffffff
    ) {
      this.length = Math.max(this._length, start + 32);
      this.bits[bytePos++] = Number((neg ? ~val : val) & 0xffffffffn) | 0;
      start += 32;
      val >>= 32n;
    }

    if (!end) {
      end = Math.max(start + 32 - Math.clz32(Number(val)), this._length);
      this.length = Math.max(this._length, end);
    }
    mask = 0xffffffff >>> -end;
    this.bits[bytePos] =
      (this.bits[bytePos] & ~mask) | Number((neg ? ~val : val) & BigInt(mask));
    return end - firstStart;
  }

  appendBigBits(val: bigint, bitCount?: number): number {
    return this.setBigBits(
      val,
      this._length,
      bitCount === undefined ? bitCount : this._length + bitCount,
    );
  }

  countBits(): number {
    return this.bits.reduce((t, v) => t + countBits(v), 0);
  }

  shift(count: number): this {
    if (count < 0) {
      count = -count;
      const offset = count >>> 5;
      const shift = count & 0b11111;
      if (shift === 0) {
        // short circuit
        for (let i = 0; i < this.bits.length - offset; i++) {
          this.bits[i] = this.bits[i + offset];
        }
      } else {
        let i = 0;
        for (; i < this.bits.length - offset - 1; i++) {
          this.bits[i] =
            (this.bits[i + offset] >>> shift) |
            (this.bits[i + offset + 1] << -shift);
        }
        this.bits[i] = this.bits[i + offset] >>> shift;
      }
      this.length -= count;
    } else if (count > 0) {
      const offset = count >>> 5;
      const shift = count & 0b11111;
      this.length += count + 32;
      if (shift === 0) {
        // short circuit
        for (let i = this.bits.length - 1; i >= offset; i--) {
          this.bits[i] = this.bits[i - offset];
        }
      } else {
        for (let i = this.bits.length - 1; i > offset; i--) {
          this.bits[i] =
            (this.bits[i - offset] << shift) |
            (this.bits[i - offset - 1] >>> -shift);
        }
        this.bits[offset] = this.bits[0] << shift;
      }
      this.length -= 32;
    }
    return this;
  }

  /** Return the contents of this BitSet as a bigint. */
  toBigInt(start = 0): bigint {
    return this.getBigBits(start, this._length);
  }

  toReader(start?: number, end?: number): BitSetReader {
    return new BitSetReader(this, start, end);
  }

  toWriter(start?: number, end?: number): BitSetWriter {
    return new BitSetWriter(this, start, end);
  }

  /**
   * Make a copy of this BitSet.
   */
  clone(): BitSet {
    return new BitSet([...this.bits], this._length);
  }

  [Symbol.iterator](): Generator<Bit> {
    return biterator(this.toReader());
  }

  toString(radix = 2): string {
    const r = this.toBigInt().toString(radix);
    return (
      '0'.repeat(
        Math.max(
          Math.trunc(Math.log(2 ** this.length) / Math.log(radix)) - r.length,
          0,
        ),
      ) + r
    );
  }
}

/** Return the byte and bit position of a given bit-index */
function getPosition(index: number) {
  return {
    bytePos: index >>> 5,
    bitPos: index & 0b11111,
  };
}

/**
 * An abstract Reader that handles all details except
 */
export abstract class AbstractBitReader implements BitReader {
  protected done = false;

  constructor(protected bitsAvailable = -1) {}

  /**
   * Similar to `readBits`, but guaranteed to have a bitCount between 1 and 32
   */
  protected abstract getBits(bitCount: number): number;

  read(): Bit {
    assert(!this.done, 'End of stream');
    this.bitsAvailable--;
    return this.getBits(1) as Bit;
  }

  readBatch(bitCount = 32): number {
    if (bitCount === 0) {
      return 0;
    }
    assert(!this.done, 'End of stream');
    assert(
      bitCount >= 0 && bitCount <= 32,
      'bitCount must be between 0 and 32 inclusive',
    );
    try {
      this.bitsAvailable -= bitCount;
      return this.getBits(bitCount);
    } catch (e) {
      this.bitsAvailable = 0;
      this.done = true;
      throw e;
    }
  }

  readBigBits(bitCount?: number | undefined): bigint {
    assert(!this.done, 'End of stream');
    bitCount = bitCount ?? -1;
    try {
      let result = 0n;
      let bitsWritten = 0;
      let recommendedReadBits = this.pending();
      while (bitCount < 0 ? recommendedReadBits > 0 : bitCount > bitsWritten) {
        assert(recommendedReadBits > 0, 'End of stream');
        const bitsToWrite =
          bitCount < 0
            ? recommendedReadBits
            : Math.min(bitCount - bitsWritten, recommendedReadBits);
        result |=
          BigInt(this.getBits(bitsToWrite) >>> 0) << BigInt(bitsWritten);
        bitsWritten += bitsToWrite;
        this.bitsAvailable -= bitsToWrite;
        recommendedReadBits = this.pending();
      }
      return result;
    } catch (e) {
      this.bitsAvailable = 0;
      this.done = true;
      throw e;
    }
  }

  maxBatch(): number {
    return 32;
  }

  count(): number {
    return this.done ? 0 : this.bitsAvailable < 0 ? -1 : this.bitsAvailable;
  }

  pending(): number {
    return this.done ? 0 : 1;
  }

  close(): void {
    this.done = true;
  }

  isClosed(): boolean {
    return this.done;
  }

  asBigBitReader(): BigBitReader {
    return {
      read: () => this.read(),
      readBatch: (bitCount?) => this.readBigBits(bitCount),
      maxBatch: () => 0xffffffff,
      count: () => this.count(),
      pending: () => this.pending(),
      close: () => this.close(),
      isClosed: () => this.isClosed(),
      asBitReader: () => this,
    };
  }
}

class BitIterReader extends AbstractBitReader {
  constructor(private readonly iter: Iterator<Bit>) {
    super();
  }

  protected override getBits(bitCount: number): number {
    let val = 0;
    for (let i = 0; i < bitCount; i++) {
      const next = this.iter.next();
      if (next.done) {
        this.done = true;
        throw new Error('Stream ended');
      }
      val |= next.value << i;
    }
    return val;
  }
}

/** Convert any source of bits into a BitReader */
export function toBitReader(source: IterType<Bit>): BitReader {
  return new BitIterReader(asIterator(source));
}

class BitArrayWriter implements BitWriter {
  private i = 0;
  private closed = false;
  constructor(private readonly output: Bit[]) {}

  write(value: Bit): this {
    assert(!this.closed);
    this.output[this.i++] = value;
    return this;
  }
  writeBatch(value: number, itemCount = 32): this {
    for (let i = 0; i < itemCount; i++) {
      this.write(((value >>> i) & 1) as Bit);
    }
    return this;
  }
  writeBigBits(value: bigint, itemCount = -1): this {
    for (let i = 0; itemCount < 0 ? value : i < itemCount; i++) {
      this.write(Number(value & 1n) as Bit);
      value >>= 1n;
    }
    return this;
  }
  isClosed(): boolean {
    return this.closed;
  }
  close(): void {
    this.closed = true;
  }
  asBigBitWriter(): BigBitWriter {
    const writer: BigBitWriter = {
      write: v => {
        this.write(v);
        return writer;
      },
      writeBatch: (v, i) => {
        this.writeBigBits(v, i);
        return writer;
      },
      isClosed: () => this.isClosed(),
      close: () => this.close(),
      asBitWriter: () => this,
    };
    return writer;
  }
}
export function toBitWriter(destination: Bit[]) {
  return new BitArrayWriter(destination);
}

/**
 * A Reader backed by a BitSet. This supports starting at an arbitrary point in
 * the BitSet.
 */
export class BitSetReader extends AbstractBitReader {
  private pos: number;

  constructor(
    readonly bitset: BitSet,
    start = 0,
    public end?: number,
  ) {
    super();
    assert(start >= 0, 'start must be non-negative');
    assert(end === undefined || end >= start, 'end must be greater than start');
    this.pos = start;
  }

  /** True if this iterator is past the current length of the BitSet */
  override isClosed(): boolean {
    return this.done || this.pos >= (this.end ?? this.bitset.length);
  }

  /** Get the next number */
  protected override getBits(bitCount: number): number {
    assert(
      this.pos + bitCount <= (this.end ?? this.bitset.length),
      'No data available',
    );
    const start = this.pos;
    this.pos += bitCount;
    return this.bitset.getBits(start, this.pos);
  }

  override count(): number {
    return this.done ? 0 : (this.end ?? this.bitset.length) - this.pos;
  }

  override pending(): number {
    const bitsRemaining = this.count();
    const bitsToAlignment = 32 - (this.pos & 0b11111);
    return bitsRemaining >= 0 && bitsRemaining <= bitsToAlignment
      ? bitsRemaining
      : bitsToAlignment;
  }
}

/**
 * A Writer backed by a BitSet. This supports starting at an arbitrary point in
 * the BitSet.
 */
export class BitSetWriter implements BitWriter {
  readonly bitset: BitSet;
  private pos: number;
  private closed = false;

  constructor(
    bitset = new BitSet(),
    start = bitset.length,
    public end?: number,
  ) {
    assert(start >= 0, 'start must be non-negative');
    assert(end === undefined || end >= start, 'end must be greater than start');
    this.bitset = bitset ?? new BitSet();
    this.pos = start;
  }

  /** True if this iterator is past the current length of the BitSet */
  isClosed(): boolean {
    return this.closed || (!!this.end && this.pos >= this.end);
  }

  /** Write a single bit */
  write(bit?: Bit): this {
    this.assertBitCount(1);
    this.bitset.setBit(this.pos, bit);
    this.pos++;
    return this;
  }

  /**
   * Write the low bits of a 32-bit number. If bitCount is not set, 32 bits are
   * written
   */
  writeBatch(val: number, bitCount?: number): this {
    bitCount = bitCount ?? 32;
    this.assertBitCount(bitCount);
    this.bitset.setBits(val, this.pos, this.pos + bitCount);
    this.pos += bitCount;
    return this;
  }

  /**
   * Write the low bits of a bigint. If bitCount is not set, the entire bigint
   * us written up to its highest set bit. Negative values can not be written.
   */
  writeBigBits(val: bigint, bitCount?: number): this {
    if (this.end !== undefined && bitCount === undefined) {
      bitCount = this.end - this.pos;
    }
    this.assertBitCount(bitCount ?? 0);
    if (bitCount === undefined) {
      bitCount = this.bitset.setBigBits(val, this.pos);
    } else {
      this.bitset.setBigBits(val, this.pos, this.pos + bitCount);
    }
    this.pos += bitCount;
    return this;
  }

  close() {
    this.closed = true;
  }

  private assertBitCount(bitCount: number) {
    assert(!this.closed, 'Stream is closed');
    assert(!this.end || this.pos + bitCount <= this.end, 'End of stream');
  }

  asBigBitWriter(): BigBitWriter {
    const bigBitWriter: BigBitWriter = {
      write: value => {
        this.write(value);
        return bigBitWriter;
      },
      writeBatch: (batch, itemCount?) => {
        this.writeBigBits(batch, itemCount);
        return bigBitWriter;
      },
      isClosed: () => this.isClosed(),
      close: () => this.close(),
      asBitWriter: () => this,
    };
    return bigBitWriter;
  }
}

export type Bits = {value: number | bigint; bitCount: number};

/**
 * Creates a Reader from a `Bits` generator
 */
export class BitSourceReader extends AbstractBitReader {
  private value: number | bigint = 0;
  private bitCount = 0;
  private readonly source: Iterator<Bits>;

  constructor(source: IterType<Bits>, bitCount?: number) {
    super(bitCount);
    if (Array.isArray(source) && bitCount === undefined) {
      // we can calculate the bitCount with an array
      this.bitsAvailable = source.reduce(
        (a: number, c: Bits) => a + c.bitCount,
        0,
      );
    }
    this.source = asIterator(source);
  }

  static create(source: number[], bitsPerInput: number): BitSourceReader;
  static create(source: number, bitCount: number): BitSourceReader;
  static create(
    source: number | number[],
    bitsPerInput: number,
  ): BitSourceReader {
    source = typeof source === 'number' ? [source] : source;
    return new BitSourceReader(
      source.map(s => ({value: s, bitCount: bitsPerInput})),
      bitsPerInput * source.length,
    );
  }

  protected getBits(bitCount: number): number {
    this.checkSource();
    let result = 0;
    let bitsWritten = 0;

    while (this.bitCount + bitsWritten < bitCount) {
      assert(!this.done, 'Stream is ended');
      result |= (Number(this.value) & (-1 >>> -this.bitCount)) << bitsWritten;
      bitsWritten += this.bitCount;
      this.bitCount = 0;

      this.checkSource();
    }

    assert(!this.done, 'Stream is ended');
    if (typeof this.value === 'bigint') {
      result |=
        Number(this.value & ((1n << BigInt(bitCount - bitsWritten)) - 1n)) <<
        bitsWritten;
      this.value >>= BigInt(bitCount - bitsWritten);
    } else {
      result |= (this.value & (-1 >>> (bitsWritten - bitCount))) << bitsWritten;
      this.value >>>= bitCount - bitsWritten;
    }
    this.bitCount -= bitCount - bitsWritten;

    return result;
  }

  override pending(): number {
    this.checkSource();
    return this.bitCount;
  }

  override count(): number {
    this.checkSource();
    return super.count();
  }

  override isClosed(): boolean {
    this.checkSource();
    return this.done;
  }

  private checkSource(): void {
    if (!this.done && this.bitCount === 0) {
      const next = this.source.next();
      if (next.done) {
        this.done = true;
      } else {
        assert(
          next.value.bitCount >= 0 && next.value.bitCount <= 32,
          'bitcount must be between 1 and 32 inclusive',
        );
        this.value = next.value.value;
        this.bitCount = next.value.bitCount;
      }
    }
  }
}

class ConcatenatedReader extends AbstractBitReader {
  private idx = 0;
  constructor(private readonly readers: BitReader[]) {
    super();
    let bitsRemaining = 0;
    for (let i = 0; i < this.readers.length; i++) {
      const b = this.readers[i].count();
      if (b < 0) {
        bitsRemaining = -1;
        break;
      }
      bitsRemaining += b;
    }
    this.bitsAvailable = bitsRemaining;
    this.checkReader();
  }

  override pending(): number {
    return this.done ? 0 : this.readers[this.idx].pending();
  }

  protected getBits(bitCount: number): number {
    let val = 0;
    let recommendedReadBits = this.pending();
    let bitsWritten = 0;
    while (bitsWritten + recommendedReadBits < bitCount) {
      assert(recommendedReadBits > 0, 'End of stream');
      val |=
        this.readers[this.idx].readBatch(recommendedReadBits) << bitsWritten;
      bitsWritten += recommendedReadBits;
      this.checkReader();
      recommendedReadBits = this.pending();
    }
    val |=
      this.readers[this.idx].readBatch(bitCount - bitsWritten) << bitsWritten;
    this.checkReader();
    return val;
  }

  private checkReader() {
    while (this.readers[this.idx]?.isClosed()) {
      this.idx++;
    }
    if (this.idx >= this.readers.length) {
      this.done = true;
    }
  }
}

export function concatenateReaders(readers: BitReader[]): BitReader {
  return new ConcatenatedReader(readers);
}

export function copy<T, M>(
  source: Reader<T, M>,
  destination: Writer<T, M>,
  bitCount?: number,
): void {
  bitCount = bitCount ?? Number.MAX_VALUE;
  const maxBatch = source.maxBatch();
  let readItems = Math.min(maxBatch, Math.min(bitCount, source.pending()));
  while (readItems > 0) {
    destination.writeBatch(source.readBatch(readItems), readItems);
    readItems = Math.min(maxBatch, Math.min(bitCount, source.pending()));
  }
}
