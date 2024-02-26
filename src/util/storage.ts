/** This calculates a standard Huffman prefix code for a given input */

import { assert } from './assert.js';
import {
  BitSet,
  BitSetWriter,
  BitReader,
  BitWriter,
  Writer,
  Reader,
  Bit,
} from './io.js';
import { trace } from './logging.js';

/** An encoder/decoder */
export interface Coder<
  Decoded,
  Encoded = Bit,
  EncodedBatch = Encoded extends Bit ? number : Encoded[],
> {
  /**
   * Encode the input to a Writer.
   *
   * @param input The value to encode
   * @param output The destination for the encoded conents
   */
  encode(input: Decoded, output: Writer<Encoded, EncodedBatch>): void;

  /**
   * Dencode the input to a value.
   *
   * @param input The value to decode
   * @returns The decoded value
   */
  decode(input: Reader<Encoded, EncodedBatch>): Decoded;
}

/** Helper function to encode a value to a BitSet */
export function encodeToBitset<T>(
  input: T,
  coder: Coder<T>,
  bitset = new BitSet()
): BitSet {
  coder.encode(input, bitset.toWriter());
  return bitset;
}

/**
 * An encoder/decoder for VLQ values. See
 * https://en.wikipedia.org/wiki/Variable-length_quantity for details. Unlike
 * standard VLQ that uses 7-bits for `payloadBits`, this encoding allows any
 * positive value.
 */
export class VariableLengthQuantityCoder implements Coder<number> {
  constructor(readonly payloadBits: number) {
    assert(
      payloadBits > 0 && payloadBits < 32,
      'Payload bits must be > 0 and < 32'
    );
  }

  encode(val: number, output: BitWriter): void {
    this.encodeBitSet(new BitSetWriter().writeBatch(val).bitset, output);
  }
  encodeBigInt(val: bigint, output: BitWriter): void {
    this.encodeBitSet(new BitSetWriter().writeBigBits(val).bitset, output);
  }
  private encodeBitSet(input: BitSet, output: BitWriter): void {
    input.trim();
    if (!input.length) input.length = 1;
    const reader = input.toReader();

    for (;;) {
      const readBits = Math.min(this.payloadBits, reader.count());
      output.writeBatch(reader.readBatch(readBits), readBits);
      if (reader.isClosed()) {
        output.writeBatch(0, this.payloadBits + 1 - readBits);
        return;
      }
      output.write(1);
    }
  }
  decode(input: BitReader): number {
    const output = this.decodeBitSet(input);
    assert(
      output.length <= 32,
      "Value too large, can't decode to number. Use the bigint version"
    );
    return output.getBits(0);
  }
  decodeBigInt(input: BitReader): bigint {
    const bitsRemaining = input.count();
    return this.decodeBitSet(
      input,
      bitsRemaining < 0 ? 128 : bitsRemaining
    ).toBigInt();
  }
  private decodeBitSet(input: BitReader, initialCapacity = 64): BitSet {
    const output = new BitSetWriter();
    if (input.isClosed()) {
      return output.bitset;
    }
    for (;;) {
      output.writeBatch(input.readBatch(this.payloadBits), this.payloadBits);
      if (!input.read()) {
        return output.bitset.trim();
      }
    }
  }

  /** Returns a VLQ coder for bigint values */
  bigintCoder(): Coder<bigint> {
    return {
      encode: (val: bigint, output: BitWriter) => {
        this.encodeBigInt(val, output);
      },
      decode: (input: BitReader) => this.decodeBigInt(input),
    };
  }
}

/**
 * Like VLQ Encoding, this starts with the low `payloadBits` bits of a value,
 * and sets the next bit to '0' if the number is fully encoded, or a '1' if more
 * bits are required, but the following bits are encoded differently.
 *
 * The following bits are either:
 * 1: There is a single '1' digit appended to the value, and it is complete.
 * 01: There is a '1' digit appended, and there are more digits.
 * 00: There is a '0' digit appended, and there are more digits.
 *
 * We don't have to encode the case where we have a terminating '0' since
 * appending '0's to the high end of an integer doesn't change its value.
 *
 * When encoding, the provided reader must terminate with a '1' character.
 */
export class BitExtendedCoder implements Coder<number> {
  constructor(readonly payloadBits: number) {
    assert(
      payloadBits >= 0 && payloadBits < 32,
      'Payload bits must be >= 0 and < 32'
    );
  }

  encode(val: number, output: BitWriter): void {
    this.encodeBitSet(new BitSetWriter().writeBatch(val).bitset, output);
  }

  encodeBigInt(val: bigint, output: BitWriter): void {
    this.encodeBitSet(new BitSetWriter().writeBigBits(val).bitset, output);
  }

  private encodeBitSet(input: BitSet, output: BitWriter): void {
    input.trim();
    if (!input.length) input.length = 1;
    const reader = input.toReader();

    if (this.payloadBits) {
      const readBits = Math.min(this.payloadBits, reader.count());
      output.writeBatch(reader.readBatch(readBits), readBits);
      if (reader.isClosed()) {
        output.writeBatch(0, this.payloadBits + 1 - readBits);
        return;
      }
      output.write(1);
    }

    for (;;) {
      const bit = reader.read();
      if (reader.isClosed()) {
        assert(bit, 'Reader must terminate with a zero');
        output.write(0);
        return;
      }
      output.writeBatch(bit ? 0b11 : 0b01, 2);
    }
  }

  decode(encoded: BitReader): number {
    const decoded = this.decodeBitSet(encoded);
    assert(
      decoded.length <= 32,
      "Value too large, can't decode to number. Use the bigint version"
    );
    return decoded.getBits(0);
  }
  decodeBigInt(encoded: BitReader): bigint {
    return this.decodeBitSet(encoded).toBigInt();
  }
  private decodeBitSet(input: BitReader): BitSet {
    const output = new BitSetWriter();
    if (input.isClosed()) {
      return output.bitset;
    }
    if (this.payloadBits) {
      output.writeBatch(input.readBatch(this.payloadBits), this.payloadBits);
      if (!input.read()) {
        return output.bitset.trim();
      }
    }
    for (;;) {
      const continueBit = input.read();
      if (!continueBit) {
        return output.write().bitset;
      }
      output.write(input.read());
    }
  }

  /** Returns a BitExtended coder for bigint values */
  bigintCoder(): Coder<bigint> {
    return {
      encode: (val: bigint, output: BitWriter) => {
        this.encodeBigInt(val, output);
      },
      decode: (input: BitReader) => this.decodeBigInt(input),
    };
  }
}

/**
 * An encoding that maps positive and negative integers on their distance from
 * zero. It allows just using the low bits to represent smaller values. The
 * mapping looks like:
 *
 * ...
 * 3: 6
 * 2: 4
 * 1: 2
 * 0: 0
 * -1: 1
 * -2: 3
 * -3: 5
 * ...
 */
export const InterleaveCoder = {
  encode: (decoded: number): number =>
    decoded < 0 ? (~decoded << 1) | 1 : decoded << 1,
  decode: (encoded: number): number =>
    encoded & 1 ? ~(encoded >>> 1) : encoded >>> 1,
};

/**
 * Used for numbers that are expected to be close to a given base, but can't be
 * less than a given value.
 *
 * Ex. say the min is 5, and the base is 8. We want to encode as follows:
 * 5: 5
 * 6: 3
 * 7: 1
 * 8: 0
 * 9: 2
 * 10: 4
 * 11: 6
 * 12: 7
 * 13: 8
 * 14: 9
 *
 * ...
 *
 * It uses interleaving for the first 2*(base - min)+1 digits, then a simple
 * offset for the remaining.
 */
export class DeltaCoder {
  constructor(
    readonly base: number,
    readonly min = 0
  ) {
    assert(min <= base);
  }

  static encode(decoded: number, base: number, min?: number) {
    return new DeltaCoder(base, min).encode(decoded);
  }

  static decode(encoded: number, base: number, min?: number) {
    return new DeltaCoder(base, min).decode(encoded);
  }

  encode(decoded: number): number {
    assert(decoded >= this.min);
    if (decoded >= 2 * (this.base - this.min) + this.min) {
      return decoded - this.min;
    } else {
      return InterleaveCoder.encode(decoded - this.base);
    }
  }
  decode(encoded: number): number {
    assert(encoded >= 0);
    if (encoded < 2 * (this.base - this.min)) {
      return InterleaveCoder.decode(encoded) + this.base;
    } else {
      return encoded + this.min;
    }
  }
}

export function encodeGrid(
  input: BitSet,
  width: number,
  output?: BitSet
): BitSet {
  output = output ?? new BitSet();
  const outputBitSet = output;
  let outputPos = 0;

  enum GridState {
    ALL_ZERO,
    ALL_ONE,
    MIXED,
  }

  /** Delve into a roughly square-ish block and encode the data */
  function delve(grid: GridRect): GridState {
    const splits = split(grid);

    // assume mixed
    const pos = outputPos;
    outputBitSet.setBit(outputPos++);

    if (splits.length === 1) {
      const { x, y, w, h } = splits[0];
      let v = 0;
      for (let dy = y; dy < y + h; dy++) {
        for (let dx = x; dx < x + w; dx++) {
          const b = input.getBit(dy * width + dx);
          v += b;
          outputBitSet.setBit(outputPos++, b);
        }
      }
      trace('Working on small grid: %o', { x, y, w, h, v });
      if (v === 0) {
        outputPos = pos;
        outputBitSet.setBits(0b00, outputPos, (outputPos += 2));
        return GridState.ALL_ZERO;
      } else if (v === w * h) {
        outputPos = pos;
        outputBitSet.setBits(0b10, outputPos, (outputPos += 2));
        return GridState.ALL_ONE;
      } else {
        return GridState.MIXED;
      }
      // do something
    } else {
      let allOneCount = 0;
      let allZeroCount = 0;
      for (const rect of splits) {
        switch (delve(rect)) {
          case GridState.ALL_ZERO:
            allZeroCount++;
            break;
          case GridState.ALL_ONE:
            allOneCount++;
            break;
          default:
          // nothing
        }
      }
      if (allZeroCount === splits.length) {
        outputPos = pos;
        outputBitSet.setBits(0b00, outputPos, (outputPos += 2));
        return GridState.ALL_ZERO;
      } else if (allOneCount === splits.length) {
        outputPos = pos;
        outputBitSet.setBits(0b10, outputPos, (outputPos += 2));
        return GridState.ALL_ONE;
      } else {
        return GridState.MIXED;
      }
    }
  }

  interface GridRect {
    x: number;
    w: number;
    y: number;
    h: number;
  }
  function split(rect: GridRect): GridRect[] {
    const { x, y, w, h } = rect;

    // first check if everything is under 4
    if (w < 4 && h < 4) {
      return [rect];
    }

    // next check for splits to make better squares
    if (h > w) {
      const vSplit = Math.round(h / w);
      if (vSplit > 1) {
        const splits: GridRect[] = [];
        for (let i = 0; i < vSplit; i++) {
          const yStart = y + Math.trunc((i * h) / vSplit);
          const yEnd = y + Math.trunc(((i + 1) * h) / vSplit);
          splits.push({ x, y: yStart, w, h: yEnd - yStart });
        }
        return splits;
      }
    } else {
      const hSplit = Math.round(w / h);
      if (hSplit > 1) {
        const splits: GridRect[] = [];
        for (let i = 0; i < hSplit; i++) {
          const xStart = x + Math.trunc((i * w) / hSplit);
          const xEnd = x + Math.trunc(((i + 1) * w) / hSplit);
          splits.push({ x: xStart, y, w: xEnd - xStart, h });
        }
        return splits;
      }
    }

    // lastly, split on any dimension >= 4
    if (w >= 4) {
      if (h >= 4) {
        const midX = x + Math.trunc(w / 2);
        const endX = x + w;
        const midY = y + Math.trunc(h / 2);
        const endY = y + h;
        return [
          { x, y, w: midX - x, h: midY - y },
          { x: midX, y, w: endX - midX, h: midY - y },
          { x, y: midY, w: midX - x, h: endY - midY },
          { x: midX, y: midY, w: endX - midX, h: endY - midY },
        ];
      } else {
        const midX = x + Math.trunc(w / 2);
        const endX = x + w;
        return [
          { x, y, w: midX - x, h },
          { x: midX, y, w: endX - midX, h },
        ];
      }
    } else {
      const midY = y + Math.trunc(h / 2);
      const endY = y + h;
      return [
        { x, y, w, h: midY - y },
        { x, y: midY, w, h: endY - midY },
      ];
    }
  }

  const height = Math.ceil(input.length / width);

  delve({ x: 0, y: 0, w: width, h: height });

  // trim the length of output to the current position
  output.length = outputPos;

  return output;
}
