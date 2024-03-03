import {
  Bit,
  BitSet,
  BitSetWriter,
  BitReader,
  BitWriter,
  biterator,
} from '../io.js';
import {trace} from '../logging.js';
import {assert} from '../assert.js';

/**
 * A pair of factory methods for creating ArithmeticEncoder and
 * ArithmeticDecoder instances.
 */
export class Arithmetic {
  /** Create an ArithmeticEncoder. */
  static encoder(output: BitWriter): ArithmeticEncoder {
    return new ArithmeticEncoderImpl(output);
  }

  static decoder(encoded: BitReader, padStream?: boolean): ArithmeticDecoder {
    return new ArithmeticDecoderImpl(encoded, padStream);
  }
}

/**
 * A writer for Arithmetic encoding. Each bit written is paired with a
 * probability and encoded to an underlying writer.
 */
export interface ArithmeticEncoder {
  /**
   * Write a single bit, with an associated probability.
   *
   * @throws if this encoder is closed
   */
  encodeBit(p: number, b: Bit): void;

  /**
   * Close this Arithmetic Writer. Note: This does *not* close the underlying
   * writer. It flushes any pending bits, and writes enough information to the
   * stream to ensure the decoder can restore the original stream.
   *
   * @param terminateStream If true, enough bits are written such that the
   *    decoder will not have to pad the end of its Reader. Though this
   *    typically involves an extra bit, it allows for more data to be written
   *    after in the underlying writer.
   */
  close(terminateStream?: boolean): void;

  /** Returns true if this encoder is closed. */
  isClosed(): boolean;

  /**
   * Create a clone of this encoder, saving its state. This allows for a partial
   * encoding to be saved, and then multiple endings to be created from that
   * state.
   */
  clone(writer: BitWriter): ArithmeticEncoder;
}

/**
 * A reader for Arithmetic decoding. Each bit read is preceded by a probability
 * allowing the decoded bits to be generated.
 */
export interface ArithmeticDecoder {
  /**
   * Read a decoded bit from the reader. Note, it is possible for this decoder
   * to return isClosed() => false, but then throw an error on the next call to
   * decodeBit. The issue is that it's impossible to know if the end of the
   * stream has been reached until the next probability value is provided. As
   * such, clients must maintain some external means of detecting the end of the
   * stream to prevent this error.
   *
   * @param p The probability that the next bit will be a zero. Must match
   *    exactly the probability used when the stream was encoded.
   *
   * @returns The next bit
   * @throws if this decoder is closed, or if there are no more bits in the
   *    encoded stream.
   */
  decodeBit(p: number): Bit;

  /**
   * Close this Arithmetic Reader. Note: This does *not* close the underlying
   * reader.
   */
  close(): void;

  /** Returns true if this decoder is closed. */
  isClosed(): boolean;
}

/**
 * A generic coder that encodes/decodes from a reader/decoder to an
 * encoder/writer.
 */
export interface ArithmeticCoder {
  /** Encode from a reader */
  encode(input: BitReader, encoder: ArithmeticEncoder): void;
  /** Decode to a writer */
  decode(decoder: ArithmeticDecoder, output: BitWriter): void;
}

/**
 * A generic coder thet encodes/decodes a value
 */
export interface ArithmeticValueCoder<V> {
  /** Encode a value */
  encodeValue(value: V, encoder: ArithmeticEncoder): void;
  /** Decode a value */
  decodeValue(decoder: ArithmeticDecoder): V;
}

/** A pairing of a bit pattern with a probability */
export interface ArithmeticSymbol {
  value: BitSet;
  weight: number;
}

/** A Coder that uses distinct bit patterns and weights as the values */
export class ArithmeticModel
  implements ArithmeticValueCoder<BitSet>, ArithmeticCoder
{
  private readonly root: Node;

  constructor(symbols: ArithmeticSymbol[]) {
    this.root = generateModelTree(symbols);
  }

  /** Encode a single symbol from input */
  encode(input: BitReader, encoder: ArithmeticEncoder): void {
    let node: Node = this.root;
    for (;;) {
      const bit = input.read();
      encoder.encodeBit(node.p, bit);
      const child = node.children[bit];
      if (!child) {
        return;
      }
      node = child;
    }
  }

  encodeValue(value: BitSet, encoder: ArithmeticEncoder): void {
    const reader = value.toReader();
    this.encode(reader, encoder);
    assert(reader.isClosed(), 'value contains data past the symbol');
  }

  decode(decoder: ArithmeticDecoder, output: BitWriter): void {
    let node: Node | undefined = this.root;
    do {
      const bit = decoder.decodeBit(node.p);
      output.write(bit);
      node = node.children[bit];
    } while (node);
  }

  decodeValue(decoder: ArithmeticDecoder): BitSet {
    const output = new BitSetWriter();
    this.decode(decoder, output);
    return output.bitset;
  }
}

/**
 * Convenience function to encode a decoded stream to a provided writer. This
 * prevents a caller from having to manage creation and closing of the
 * ArithmeticEncoder.
 *
 * @param input
 */
export function encodeToWriter(
  input: BitReader,
  coder: ArithmeticCoder,
  writer: BitWriter,
  options?: {terminateStream?: boolean; count?: number},
): void {
  const terminateStream = options?.terminateStream ?? true;
  const count = options?.count ?? 1;
  const encoder = Arithmetic.encoder(writer);
  for (let i = 0; i < count; i++) {
    coder.encode(input, encoder);
  }
  encoder.close(terminateStream);
}

/** Convenience function to encode an input to a bitset. */
export function encodeToBitSet(
  input: BitReader,
  coder: ArithmeticCoder,
  output?: BitSetWriter,
  count?: number,
): BitSet;
export function encodeToBitSet(
  input: BitReader,
  coder: ArithmeticCoder,
  count: number,
): BitSet;
export function encodeToBitSet(
  input: BitReader,
  coder: ArithmeticCoder,
  outputOrCount?: BitSetWriter | number,
  count?: number,
): BitSet {
  let writer: BitSetWriter;
  let terminateStream = false;
  if (typeof outputOrCount === 'number') {
    count = outputOrCount;
    writer = new BitSetWriter();
  } else {
    terminateStream = !!outputOrCount;
    writer = outputOrCount ?? new BitSetWriter();
    count = count ?? 1;
  }

  encodeToWriter(input, coder, writer, {terminateStream, count});
  return writer.bitset;
}

/** Convenience function to encode a value to a Writer */
export function encodeValuesToWriter<V>(
  value: V[],
  coder: ArithmeticValueCoder<V>,
  writer: BitWriter,
  terminateStream = true,
): void {
  const encoder = Arithmetic.encoder(writer);
  for (const val of value) {
    coder.encodeValue(val, encoder);
  }
  encoder.close(terminateStream);
}
export function encodeValueToWriter<V>(
  value: V,
  coder: ArithmeticValueCoder<V>,
  writer: BitWriter,
  terminateStream = true,
): void {
  return encodeValuesToWriter([value], coder, writer, terminateStream);
}

/** Convenience function to encode a value to a BitSet */
export function encodeValuesToBitSet<V>(
  value: V[],
  coder: ArithmeticValueCoder<V>,
  output?: BitSetWriter,
): BitSet {
  const bitset = output ? output.bitset : new BitSet();
  const writer = output ?? bitset.toWriter();
  encodeValuesToWriter(value, coder, writer, !!output);
  return bitset;
}
export function encodeValueToBitSet<V>(
  value: V,
  coder: ArithmeticValueCoder<V>,
  output?: BitSetWriter,
): BitSet {
  return encodeValuesToBitSet([value], coder, output);
}

/**
 * Convenience function to decode an encoded stream to a provided writer. This
 * prevents a caller from having to manage creation and closing of the
 * ArithmeticDecoder
 */
export function decodeToWriter(
  encoded: BitReader,
  coder: ArithmeticCoder,
  writer: BitWriter,
  options?: {count?: number; padStream?: boolean},
): void {
  const count = options?.count ?? 1;
  const padStream = options?.padStream ?? false;
  const decoder = Arithmetic.decoder(encoded, padStream);
  for (let i = 0; i < count; i++) {
    coder.decode(decoder, writer);
  }
  decoder.close();
}

/** Convenience function to decode an encoded stream to a bitset. */
export function decodeToBitSet(
  encoded: BitReader,
  coder: ArithmeticCoder,
  output?: BitSetWriter,
  count?: number,
): BitSet;
export function decodeToBitSet(
  encoded: BitReader,
  coder: ArithmeticCoder,
  count: number,
): BitSet;
export function decodeToBitSet(
  encoded: BitReader,
  coder: ArithmeticCoder,
  outputOrCount?: BitSetWriter | number,
  count?: number,
): BitSet {
  let writer: BitSetWriter;
  let padStream = true;
  if (typeof outputOrCount === 'number') {
    count = outputOrCount;
    writer = new BitSetWriter();
  } else {
    padStream = !outputOrCount;
    writer = outputOrCount ?? new BitSetWriter();
    count = count ?? 1;
  }
  decodeToWriter(encoded, coder, writer, {count, padStream});
  return writer.bitset;
}

/** Convenience function to decode an encoded value */
export function decodeValue<V>(
  encoded: BitReader,
  coder: ArithmeticValueCoder<V>,
  padStream = true,
): V {
  const decoder = Arithmetic.decoder(encoded, padStream);
  const value = coder.decodeValue(decoder);
  decoder.close();
  return value;
}

export function decodeValues<V>(
  encoded: BitReader,
  coder: ArithmeticValueCoder<V>,
  count: number,
  padStream = true,
): V[] {
  const result: V[] = [];
  const decoder = Arithmetic.decoder(encoded, padStream);
  for (let i = 0; i < count; i++) {
    result.push(coder.decodeValue(decoder));
  }
  decoder.close();
  return result;
}

/**
 * Encode and decode streams using a fixed probability, and an optional
 * bit-count
 */
export class FixedProbabilityArithmeticCoder implements ArithmeticCoder {
  constructor(
    private readonly p: number,
    private readonly bitCount = -1,
  ) {
    assert(p >= 0 && p <= 1, 'Probability must be between zero and one');
  }

  encode(input: BitReader, encoder: ArithmeticEncoder): void {
    encoder = boundedEncoder(encoder, this.bitCount);
    if (encoder.isClosed()) return;

    for (const bit of biterator(input)) {
      encoder.encodeBit(this.p, bit);
      if (encoder.isClosed()) return;
    }
  }

  decode(decoder: ArithmeticDecoder, output: BitWriter): void {
    decoder = boundedDecoder(decoder, this.bitCount);

    while (!decoder.isClosed()) {
      output.write(decoder.decodeBit(this.p));
    }
  }
}

/**
 * An arithmetic model for cases where there is a known number of zeros, out of
 * a known total.
 */
export class CountCoder implements ArithmeticCoder {
  /**
   * @param n The total number of items to choose from
   * @param z The total number of zeros
   */
  constructor(
    private readonly n: number,
    private readonly z: number,
  ) {
    assert(n >= 0);
    assert(z >= 0 && z <= n);
    assert(
      Math.trunc(n) === n && Math.trunc(z) === z,
      'n and z must be integers',
    );
  }

  encode(input: BitReader, encoder: ArithmeticEncoder): void {
    let n = this.n;
    let z = this.z;

    for (const bit of biterator(input)) {
      encoder.encodeBit(z / n, bit);
      if (!--n) {
        return;
      }
      if (!bit) --z;
    }
  }
  decode(decoder: ArithmeticDecoder, writer: BitWriter): void {
    let n = this.n;
    let z = this.z;

    for (; n; --n) {
      const bit = decoder.decodeBit(z / n);
      writer.write(bit);
      if (!bit) --z;
    }
  }
}

/** A Coder that encodes a value evenly distributed between a max and min */
export class NumberCoder implements ArithmeticValueCoder<number> {
  private readonly max: number;
  private readonly mask: number;

  constructor(
    max: number,
    private readonly min = 0,
  ) {
    assert(max > min);
    // normalize max to be relative to min, and inclusive
    this.max = (max - min - 1) >>> 0;
    this.mask = max ? 1 << (31 - Math.clz32(this.max)) : 0;
  }

  encodeValue(value: number, encoder: ArithmeticEncoder): void {
    let mask = this.mask;
    let lowOrderState = false;
    value -= this.min;
    assert(value >= 0 && value <= this.max);
    while (mask) {
      // The p calculation goes like:
      // numZeros = mask; // mask is a single binary digit
      // numOnes =
      //   (this.max & mask) ?    // i.e if the `mask` digit is set in mask
      //     (max & (mask-1)) + 1 :  // all digits below `mask`, plus one
      //     0;  // If the `max` digit is zero, any '1' would be out of range
      //
      // ex: max = 0b1010; // inclusive
      //     val = 0b1001;
      // First bit:
      //       b = 0b1000
      // numZeros = 0b1000
      // numOnes = 0b0010 + 0b0001
      //       p = numZeros / (numZeros + numOnes)
      // Second bit:
      //       b = 0b0100
      // numZeros = 0b0100
      // numOnes = 0
      //       p = 1
      // Third bit:
      //       b = 0b0010
      // numZeros = 0b0010
      // numOnes = 0b0000 + 0b0001
      //       p = numZeros / (numZeros + numOnes)
      //
      // At this point, val's bit is '0', and max's bit is '1', so we enter the
      // state where all remaining bits get p = 0.5
      const p = lowOrderState
        ? 0.5
        : mask / (mask + (this.max & mask ? (this.max & (mask - 1)) + 1 : 0));
      const bit = value & mask ? 1 : 0;
      encoder.encodeBit(p, bit);

      lowOrderState ||= !bit && !!(this.max & mask);
      mask >>>= 1;
    }
  }
  decodeValue(decoder: ArithmeticDecoder): number {
    let mask = this.mask;
    let lowOrderState = false;
    let value = 0;
    while (mask) {
      const p = lowOrderState
        ? 0.5
        : mask / (mask + (this.max & mask ? (this.max & (mask - 1)) + 1 : 0));
      const bit = decoder.decodeBit(p);
      value |= bit * mask;

      lowOrderState ||= !bit && !!(this.max & mask);
      mask >>>= 1;
    }
    return value + this.min;
  }
}

export class BitExtendedCoder
  implements ArithmeticCoder, ArithmeticValueCoder<number>
{
  private readonly p: number;

  /**
   * @param payloadBits the number of bits in the initial payload
   * @param p the probability that any extended bits will be needed. Ex, for
   *    a payload of 3, the first four bits hava a 0.5 probability. If that last
   *    bit was a '1', then the immediately following bit has a `p` chance of
   *    being a '0'. Similarly (if continued) the next bit is a 50/50, but the
   *    one following has `p` chance of being a '0'. And so on.
   */
  constructor(
    private readonly payloadBits: number,
    p = 0.5,
  ) {
    this.p = 1 - p;
  }

  encode(input: BitReader, encoder: ArithmeticEncoder): void {
    if (this.payloadBits) {
      for (let i = 0; i < this.payloadBits; ++i) {
        encoder.encodeBit(0.5, input.isClosed() ? 0 : input.read());
      }
      if (input.isClosed()) {
        encoder.encodeBit(0.5, 0);
        return;
      }
      encoder.encodeBit(0.5, 1);
    }
    for (;;) {
      const nextBit = input.isClosed() ? 0 : input.read();
      if (input.isClosed()) {
        encoder.encodeBit(this.p, 0);
        return;
      }
      encoder.encodeBit(this.p, 1);
      encoder.encodeBit(0.5, nextBit);
    }
  }

  encodeValue(value: number, encoder: ArithmeticEncoder): void {
    this.encode(
      new BitSetWriter().writeBatch(value).bitset.trim().toReader(),
      encoder,
    );
  }

  encodeBigInt(value: bigint, encoder: ArithmeticEncoder): void {
    this.encode(
      new BitSetWriter().writeBigBits(value).bitset.trim().toReader(),
      encoder,
    );
  }

  decode(decoder: ArithmeticDecoder, output: BitWriter): void {
    if (this.payloadBits) {
      for (let i = 0; i < this.payloadBits; ++i) {
        output.write(decoder.decodeBit(0.5));
      }
      const continueBit = decoder.decodeBit(0.5);
      if (!continueBit) {
        return;
      }
    }
    for (;;) {
      const endBit = decoder.decodeBit(this.p);
      if (!endBit) {
        output.write(1);
        return;
      }
      output.write(decoder.decodeBit(0.5));
    }
  }

  decodeValue(decoder: ArithmeticDecoder): number {
    const output = new BitSet();
    this.decode(decoder, output.toWriter());
    assert(
      output.trim().length <= 32,
      'Value too large for a number. Use decodeBigInt',
    );
    return output.getBits(0);
  }

  decodeBigInt(decoder: ArithmeticDecoder): bigint {
    const output = new BitSet();
    this.decode(decoder, output.toWriter());
    return output.toBigInt();
  }

  asBigintCoder(): ArithmeticCoder & ArithmeticValueCoder<bigint> {
    return {
      encode: (input, encoder) => {
        this.encode(input, encoder);
      },
      decode: (decoder, output) => {
        this.decode(decoder, output);
      },
      encodeValue: (value, encoder) => this.encodeBigInt(value, encoder),
      decodeValue: decoder => this.decodeBigInt(decoder),
    };
  }
}

/**
 * Create a view on an ArithmeticEncoder that is limited in the number of bits
 * it can encode.
 */
function boundedEncoder(
  encoder: ArithmeticEncoder,
  bitCount?: number,
): ArithmeticEncoder {
  if (bitCount === undefined || bitCount < 0) {
    // no bounds - just use the existing encoder
    return encoder;
  }
  return {
    encodeBit(p: number, b: Bit) {
      assert(bitCount! > 0, 'Stream has ended');
      encoder.encodeBit(p, b);
      bitCount!--;
    },
    close(terminateStream?: boolean) {
      encoder.close(terminateStream);
    },
    isClosed() {
      return bitCount! <= 0 || encoder.isClosed();
    },
    clone() {
      throw new Error('Not Implemented');
    },
  };
}

/**
 * Create a view on an ArithmeticDecoder that is limited in the number of bits
 * it can decode.
 */
function boundedDecoder(
  decoder: ArithmeticDecoder,
  bitCount?: number,
): ArithmeticDecoder {
  if (bitCount === undefined || bitCount < 0) {
    // no bounds - just use the existing encoder
    return decoder;
  }
  return {
    decodeBit(p: number): Bit {
      assert(bitCount! > 0, 'Stream has ended');
      bitCount!--;
      return decoder.decodeBit(p);
    },
    close() {
      decoder.close();
    },
    isClosed() {
      return bitCount! <= 0 || decoder.isClosed();
    },
  };
}

// To Keep everything below the 32-bit boundary (avoids dealing with sign
// weirdness, and keeps it performant with V8 'smi' representation), this is
// INCLUSIVE
const MAX = 0x7fffffff;
const THREE_QUARTER_31_BIT = 0x5fffffff;
const HALF_31_BIT = 0x40000000;
const QUARTER_31_BIT = 0x20000000;

/**
 * Implementation class for ArithmeticDecoder.
 *
 * The implementation was inspired (and heavily assisted) by the guide at
 * https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html
 *
 * This implementation uses 31 bits for precision of the windowing values
 * (min/max/mid), and a standard 64-bit float for the probability. This
 * previously used 64-bit float everywhere, which worked very well until it was
 * discovered to be platform dependent. Data encoded on one platform failed to
 * decode on another. The integer math solves that problem nicely, though the
 * code is more complex.
 *
 * There are some issues to consider when using this and its counterpart,
 * ArithmeticEncoderImpl to encode and decode a stream:
 *
 * * The encoder's `close` method must be called to flush any pending data and
 *   to ensure there is enough information in the stream to reproduce the source
 *   stream.
 * * When closing the stream, you can tell the encoder to 'terminate' the stream
 *   by calling `close` with `true`. This usually makes the stream longer by one
 *   bit (sometimes more), but it allows the decoder to consume the exact number
 *   of bits that were encoded, allowing additional information to be safely
 *   written to the stream after the encoded data.
 * * If the encoder is closed without a `true` flag (or an explicit `false`),
 *   then the stream will be shorter, but the decoder may accidentally consume
 *   some number of bits following the encoded data, if there are any. Only use
 *   this option when there is no additional data to be consumed, and use the
 *   `padBits` option on the decoder.
 * * When decoding, `padBits` instructs the decoder how to handle the end of the
 *   encoded stream. When set to `true`, it adds a virtual stream of infinite
 *   zeros to the end of the stream. One side-effect of this is that the caller
 *   can call `decodeBit` forever, and the Decoder will forever provide some
 *   additional data. I.e. the caller needs to manage the stop condition on its
 *   own without relying on the decoder.
 * * When decoding with `padBits` set to false, the decoder will eventually
 *   throw an error when it reaches the end of the encoded stream. Even so, it
 *   may have yielded more bits than were encoded before doing so. The number of
 *   such bits is limited by ceil(-log2(min(p, 1-p)) - 1), where `p` is the
 *   probability given in the `decodeBit` call. For example, p=0.1 yields a
 *   possible extra bit count of 3. Typically, to avoid these extra bits, the
 *   caller needs to maintain some stop condition to decide when the decoding is
 *   complete.
 *
 * For the question: Should I use `terminateStream` and `padBits`? Here is a
 * tl;dr:
 *
 * * Is the data stream going to contain any information after the encoded
 *   data? If yes, use `terminateStream = true` and `padStream = false`
 * * Are you maintaining some 'stop' condition so that calls to `decodeBit`
 *   will stop on their own? (This is often just a bit-counter, or a pattern in
 *   the stream) If not, then use `terminateStream = true` and
 *   `padStream = false`
 * * Otherwise, use `terminateStream = false` and `padStream = true`, and save
 *   a couple bits on the output.
 */
class ArithmeticDecoderImpl implements ArithmeticDecoder {
  private closed = false;
  private high = MAX;
  private low = 0;
  private value = 0;
  private rangeMask = MAX;

  constructor(
    private readonly input: BitReader,
    private readonly padStream = false,
  ) {}

  decodeBit(p: number): Bit {
    assert(!this.closed, 'Stream closed');
    if (p >= 1) {
      assert(p === 1, `[Arithmetic.decode] Invalid p: ${p}`);
      return 0;
    } else if (p <= 0) {
      assert(p === 0, `[Arithmetic.encode] Invalid p: ${p}`);
      return 1;
    }
    while (this.high - this.low < QUARTER_31_BIT) {
      let zoom: string;
      if (this.high < HALF_31_BIT) {
        this.high = (this.high << 1) | 1;
        this.value <<= 1;
        this.low <<= 1;
        zoom = 'low';
      } else if (this.low >= HALF_31_BIT) {
        this.high = ((this.high << 1) & MAX) | 1;
        this.value = (this.value << 1) & MAX;
        this.low = (this.low << 1) & MAX;
        zoom = 'high';
      } else {
        this.high = ((this.high - QUARTER_31_BIT) << 1) | 1;
        this.value = (this.value - QUARTER_31_BIT) << 1;
        this.low = (this.low - QUARTER_31_BIT) << 1;
        zoom = 'mid';
      }
      this.rangeMask = (this.rangeMask << 1) | 1;
      trace('[Arithmetic.decode] zooming %o', () => ({
        zoom,
        low: this.low,
        high: this.high,
        value: this.value,
        rangeBits: this.rangeMask,
      }));
    }

    const mid = this.low + 1 + Math.trunc(p * (this.high - this.low));

    const logData = () => {
      return {
        low: this.low,
        mid: mid,
        high: this.high,
        value: this.value,
        rangeBits: this.rangeMask,
        p,
      };
    };

    trace('[Arithmetic.decode] working on: %o', logData);
    for (;;) {
      if (this.value >= mid) {
        trace('[Arithmetic.decode] emitting 1 bit. Data: %o', logData);
        this.low = mid;
        return 1;
      } else if (this.value + this.rangeMask < mid) {
        trace('[Arithmetic.decode] emitting 0 bit. Data: %o', logData);
        this.high = mid - 1;
        return 0;
      } else {
        if (!this.padStream && this.input.isClosed()) {
          this.closed = true;
          assert(false, 'No more bits in the stream');
        }
        const bit =
          this.padStream && this.input.isClosed() ? 0 : this.input.read();
        this.rangeMask >>>= 1;
        if (bit) {
          this.value += this.rangeMask + 1;
        }
        trace('[Arithmetic.decode] Reading more. Data: %o', () => ({
          bit,
          ...logData(),
        }));
      }
    }
  }
  close(): void {
    this.closed = true;
  }
  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * Implementation class for ArithmeticEncoder. See ArithmeticDecoder for
 * general information on implementation details.
 */
class ArithmeticEncoderImpl implements ArithmeticEncoder {
  private closed = false;

  // invariant (prior to termination):
  // MAX >= high >= low >= 0
  private high = MAX;
  private low = 0;

  // the number of bits bending resolution to the 01111.. vs 1000.. status
  private pendingBits = 0;

  // the number of trailing zeros. This is used to pro-actively trim the
  // trailing zeros when `terminateStream` is false
  private trailingZeros = 0;

  constructor(
    private readonly output: BitWriter,
    state?: {
      closed: boolean;
      high: number;
      low: number;
      pendingBits: number;
      trailingZeros: number;
    },
  ) {
    if (state) {
      this.closed = state.closed;
      this.high = state.high;
      this.low = state.low;
      this.pendingBits = state.pendingBits;
      this.trailingZeros = state.trailingZeros;
    }
  }

  /**
   * Write a single bit, with an associated probability.
   *
   * @throws if this encoder is closed
   */
  encodeBit(p: number, b: Bit): void {
    assert(!this.closed, 'Stream closed');
    if (p >= 1) {
      assert(
        p === 1 && b === 0,
        `[Arithmetic.encode] Invalid p: ${p}, b: ${b}`,
      );
      // nothing to encode
      trace('[Arithmetic.encode] Got p: 1, no encoding required');
      return;
    } else if (p <= 0) {
      assert(
        p === 0 && b === 1,
        `[Arithmetic.encode] Invalid p: ${p}, b: ${b}`,
      );
      // nothing to encode
      trace('[Arithmetic.encode] Got p: 0, no encoding required');
      return;
    }

    while (this.high - this.low < QUARTER_31_BIT) {
      if (this.high < HALF_31_BIT) {
        this.zoomLow('encode');
      } else if (this.low >= HALF_31_BIT) {
        this.zoomHigh('encode');
      } else {
        this.zoomMid('encode');
      }
    }

    // This needs to stay in sync with the Decoder above
    const mid = this.low + 1 + Math.trunc(p * (this.high - this.low));

    trace('[Arithmetic.encode] working on: %o', () => ({
      low: this.low,
      mid: mid,
      high: this.high,
      p,
      b,
    }));
    if (b) {
      this.low = mid;
    } else {
      this.high = mid - 1;
    }
  }

  /**
   * Close this Arithmetic Encoder. Note: This does *not* close the underlying
   * writer. It flushes any pending bits, and writes enough information to the
   * stream to ensure the decoder can restore the original stream.
   *
   * @param terminateStream If true, enough bits are written such that the
   *    decoder will not have to pad the end of its Reader. Though this
   *    typically involves an extra bit, it allows for more data to be written
   *    after in the underlying writer.
   */
  close(terminateStream = false): void {
    if (!this.closed) {
      this.closed = true;

      if (terminateStream) {
        while (this.high < MAX || this.low > 0) {
          if (this.low > 0 && this.high >= THREE_QUARTER_31_BIT) {
            this.zoomHigh('terminating');
          } else if (this.high < MAX && this.low <= QUARTER_31_BIT) {
            this.zoomLow('terminating');
          } else {
            this.zoomMid('terminating');
          }
        }
        if (this.pendingBits) {
          // rare, but it is technically possible for pending bits to be set
          // here (requires low and high to be exactly set to 0 and 1
          // respectively after a zoom-mid)
          this.writeBit(1);
          trace('[Arithmetic.close] Terminating pending: 1');
        }
        // finish off all the remaining zeros
        for (; this.trailingZeros; --this.trailingZeros) {
          this.output.write(0);
        }
      } else {
        // different approach when not terminating - just find a viable
        // candidate with the fewest number of bits
        while (this.low > 0 || this.pendingBits) {
          if (this.high >= HALF_31_BIT) {
            this.zoomHigh('closing');
          } else {
            this.zoomLow('closing');
          }
        }
      }
    }
  }

  /** Returns true if this encoder is closed. */
  isClosed(): boolean {
    return this.closed;
  }

  clone(writer: BitWriter): ArithmeticEncoder {
    return new ArithmeticEncoderImpl(writer, {
      closed: this.closed,
      high: this.high,
      low: this.low,
      pendingBits: this.pendingBits,
      trailingZeros: this.trailingZeros,
    });
  }

  private zoomHigh(debug: string) {
    this.writeBit(1);
    this.high = ((this.high << 1) & MAX) | 1;
    this.low = this.low & HALF_31_BIT ? (this.low << 1) & MAX : 0;
    trace('[Arithmetic.zoom] %s %o', debug, () => ({
      zoom: 'high',
      low: this.low,
      high: this.high,
    }));
  }

  private zoomLow(debug: string) {
    this.writeBit(0);
    this.high = this.high & HALF_31_BIT ? MAX : (this.high << 1) | 1;
    this.low = this.low << 1;
    trace('[Arithmetic.zoom] %s %o', debug, () => ({
      zoom: 'low',
      low: this.low,
      high: this.high,
    }));
  }

  private zoomMid(debug: string) {
    this.pendingBits++;
    this.high =
      this.high >= THREE_QUARTER_31_BIT
        ? MAX
        : ((this.high - QUARTER_31_BIT) << 1) | 1;
    this.low =
      this.low <= QUARTER_31_BIT ? 0 : (this.low - QUARTER_31_BIT) << 1;
    trace('[Arithmetic.zoom] %s %o', debug, () => ({
      zoom: 'mid',
      low: this.low,
      high: this.high,
    }));
  }

  /**
   * Helper function for writing bits. This manager the pendingBits and
   * trailingZeros.
   */
  private writeBit(bit: Bit) {
    if (bit) {
      for (; this.trailingZeros; --this.trailingZeros) this.output.write(0);
      this.output.write(1);
      this.trailingZeros = this.pendingBits;
      this.pendingBits = 0;
    } else {
      if (this.pendingBits) {
        for (; this.trailingZeros >= 0; --this.trailingZeros) {
          this.output.write(0);
        }
        for (; this.pendingBits; --this.pendingBits) this.output.write(1);
      }
      ++this.trailingZeros;
    }
  }
}

/** A node in the Arithmetic Model */
interface Node {
  p: number;
  children: [Node?, Node?];
}

/** A version of Node used while building the tree */
interface NodeBuilder {
  isLeaf: boolean;
  weights: [number, number];
  children: [NodeBuilder?, NodeBuilder?];
}

/** Helper function for creating an ArithmeticModel */
function generateModelTree(symbols: ArithmeticSymbol[]): Node {
  assert(symbols.length, 'Need at least one item to construct the Model');

  function indexItem(item: ArithmeticSymbol, root: NodeBuilder): void {
    assert(item.value.length, 'Empty value');
    assert(item.weight >= 0, 'Weights must not be negative');
    if (item.weight === 0) {
      return;
    }
    let node: NodeBuilder = root;
    for (let i = 0; i < item.value.length; i++) {
      const bit = item.value.getBit(i);
      node.weights[bit] += item.weight;
      const child = (node.children[bit] = node.children[bit] ?? {
        weights: [0, 0],
        children: [undefined, undefined],
        isLeaf: false,
      });
      assert(
        !child.isLeaf,
        'Common prefix: ' +
          item.value.getBigBits(0, i) +
          ' is a prefix for ' +
          item.value.toBigInt(),
      );
      node = child;
    }
    assert(
      !node.weights[0] && !node.weights[0],
      'Indexing item is a prefix of one or more other items: ' +
        item.value.toBigInt(),
    );
    node.isLeaf = true;
  }

  // Normalize the weights and fill in empty nodes
  function normalizeTree(node?: NodeBuilder): Node | undefined {
    if (!node || node.isLeaf) {
      return undefined;
    }
    const p = node.weights[0] / (node.weights[0] + node.weights[1]);
    const children: [Node?, Node?] = [
      normalizeTree(node.children[0]),
      normalizeTree(node.children[1]),
    ];
    return {p, children};
  }

  const root: NodeBuilder = {
    isLeaf: false,
    weights: [0, 0],
    children: [undefined, undefined],
  };

  for (const item of symbols) {
    indexItem(item, root);
  }

  return normalizeTree(root)!;
}
