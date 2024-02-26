import { BitSet, BitSetWriter, biterator, } from '../io.js';
import { trace } from '../logging.js';
import { assert } from '../assert.js';
/**
 * A pair of factory methods for creating ArithmeticEncoder and
 * ArithmeticDecoder instances.
 */
export class Arithmetic {
    /** Create an ArithmeticEncoder. */
    static encoder(output) {
        return new ArithmeticEncoderImpl(output);
    }
    static decoder(encoded, padStream) {
        return new ArithmeticDecoderImpl(encoded, padStream);
    }
}
/** A Coder that uses distinct bit patterns and weights as the values */
export class ArithmeticModel {
    root;
    constructor(symbols) {
        this.root = generateModelTree(symbols);
    }
    /** Encode a single symbol from input */
    encode(input, encoder) {
        let node = this.root;
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
    encodeValue(value, encoder) {
        const reader = value.toReader();
        this.encode(reader, encoder);
        assert(reader.isClosed(), 'value contains data past the symbol');
    }
    decode(decoder, output) {
        let node = this.root;
        do {
            const bit = decoder.decodeBit(node.p);
            output.write(bit);
            node = node.children[bit];
        } while (node);
    }
    decodeValue(decoder) {
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
export function encodeToWriter(input, coder, writer, options) {
    const terminateStream = options?.terminateStream ?? true;
    const count = options?.count ?? 1;
    const encoder = Arithmetic.encoder(writer);
    for (let i = 0; i < count; i++) {
        coder.encode(input, encoder);
    }
    encoder.close(terminateStream);
}
export function encodeToBitSet(input, coder, outputOrCount, count) {
    let writer;
    let terminateStream = false;
    if (typeof outputOrCount === 'number') {
        count = outputOrCount;
        writer = new BitSetWriter();
    }
    else {
        terminateStream = !!outputOrCount;
        writer = outputOrCount ?? new BitSetWriter();
        count = count ?? 1;
    }
    encodeToWriter(input, coder, writer, { terminateStream, count });
    return writer.bitset;
}
/** Convenience function to encode a value to a Writer */
export function encodeValueToWriter(value, coder, writer, terminateStream = true) {
    value = Array.isArray(value) ? value : [value];
    const encoder = Arithmetic.encoder(writer);
    for (const val of value) {
        coder.encodeValue(val, encoder);
    }
    encoder.close(terminateStream);
}
/** Convenience function to encode a value to a BitSet */
export function encodeValueToBitSet(value, coder, output) {
    const bitset = output ? output.bitset : new BitSet();
    const writer = output ?? bitset.toWriter();
    encodeValueToWriter(value, coder, writer, !!output);
    return bitset;
}
/**
 * Convenience function to decode an encoded stream to a provided writer. This
 * prevents a caller from having to manage creation and closing of the
 * ArithmeticDecoder
 */
export function decodeToWriter(encoded, coder, writer, options) {
    const count = options?.count ?? 1;
    const padStream = options?.padStream ?? false;
    const decoder = Arithmetic.decoder(encoded, padStream);
    for (let i = 0; i < count; i++) {
        coder.decode(decoder, writer);
    }
    decoder.close();
}
export function decodeToBitSet(encoded, coder, outputOrCount, count) {
    let writer;
    let padStream = true;
    if (typeof outputOrCount === 'number') {
        count = outputOrCount;
        writer = new BitSetWriter();
    }
    else {
        padStream = !outputOrCount;
        writer = outputOrCount ?? new BitSetWriter();
        count = count ?? 1;
    }
    decodeToWriter(encoded, coder, writer, { count, padStream });
    return writer.bitset;
}
/** Convenience function to decode an encoded value */
export function decodeValue(encoded, coder, padStream = true) {
    const decoder = Arithmetic.decoder(encoded, padStream);
    const value = coder.decodeValue(decoder);
    decoder.close();
    return value;
}
export function decodeValues(encoded, coder, count, padStream = true) {
    const result = [];
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
export class FixedProbabilityArithmeticCoder {
    p;
    bitCount;
    constructor(p, bitCount = -1) {
        this.p = p;
        this.bitCount = bitCount;
        assert(p >= 0 && p <= 1, 'Probability must be between zero and one');
    }
    encode(input, encoder) {
        encoder = boundedEncoder(encoder, this.bitCount);
        if (encoder.isClosed())
            return;
        for (const bit of biterator(input)) {
            encoder.encodeBit(this.p, bit);
            if (encoder.isClosed())
                return;
        }
    }
    decode(decoder, output) {
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
export class CountCoder {
    n;
    z;
    /**
     * @param n The total number of items to choose from
     * @param z The total number of zeros
     */
    constructor(n, z) {
        this.n = n;
        this.z = z;
        assert(n >= 0);
        assert(z >= 0 && z <= n);
        assert(Math.trunc(n) === n && Math.trunc(z) === z, 'n and z must be integers');
    }
    encode(input, encoder) {
        let n = this.n;
        let z = this.z;
        for (const bit of biterator(input)) {
            encoder.encodeBit(z / n, bit);
            if (!--n) {
                return;
            }
            if (!bit)
                --z;
        }
    }
    decode(decoder, writer) {
        let n = this.n;
        let z = this.z;
        for (; n; --n) {
            const bit = decoder.decodeBit(z / n);
            writer.write(bit);
            if (!bit)
                --z;
        }
    }
}
/** A Coder that encodes a value evenly distributed between a max and min */
export class NumberCoder {
    min;
    max;
    mask;
    constructor(max, min = 0) {
        this.min = min;
        assert(max > min);
        // normalize max to be relative to min, and inclusive
        this.max = (max - min - 1) >>> 0;
        this.mask = max ? 1 << (31 - Math.clz32(this.max)) : 0;
    }
    encodeValue(value, encoder) {
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
            //numZeros = 0b1000
            // numOnes = 0b0010 + 0b0001
            //       p = numZeros / (numZeros + numOnes)
            // Second bit:
            //       b = 0b0100
            //numZeros = 0b0100
            // numOnes = 0
            //       p = 1
            // Third bit:
            //       b = 0b0010
            //numZeros = 0b0010
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
    decodeValue(decoder) {
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
export class BitExtendedCoder {
    payloadBits;
    p;
    /**
     * @param payloadBits the number of bits in the initial payload
     * @param p the probability that any extended bits will be needed. Ex, for
     *    a payload of 3, the first four bits hava a 0.5 probability. If that last
     *    bit was a '1', then the immediately following bit has a `p` chance of
     *    being a '0'. Similarly (if continued) the next bit is a 50/50, but the
     *    one following has `p` chance of being a '0'. And so on.
     */
    constructor(payloadBits, p = 0.5) {
        this.payloadBits = payloadBits;
        this.p = 1 - p;
    }
    encode(input, encoder) {
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
    encodeValue(value, encoder) {
        this.encode(new BitSetWriter().writeBatch(value).bitset.trim().toReader(), encoder);
    }
    encodeBigInt(value, encoder) {
        this.encode(new BitSetWriter().writeBigBits(value).bitset.trim().toReader(), encoder);
    }
    decode(decoder, output) {
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
    decodeValue(decoder) {
        const output = new BitSet();
        this.decode(decoder, output.toWriter());
        assert(output.trim().length <= 32, 'Value too large for a number. Use decodeBigInt');
        return output.getBits(0);
    }
    decodeBigInt(decoder) {
        const output = new BitSet();
        this.decode(decoder, output.toWriter());
        return output.toBigInt();
    }
    asBigintCoder() {
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
function boundedEncoder(encoder, bitCount) {
    if (bitCount === undefined || bitCount < 0) {
        // no bounds - just use the existing encoder
        return encoder;
    }
    return {
        encodeBit(p, b) {
            assert(bitCount > 0, 'Stream has ended');
            encoder.encodeBit(p, b);
            bitCount--;
        },
        close(terminateStream) {
            encoder.close(terminateStream);
        },
        isClosed() {
            return bitCount <= 0 || encoder.isClosed();
        },
        clone(writer) {
            throw new Error('Not Implemented');
        },
    };
}
/**
 * Create a view on an ArithmeticDecoder that is limited in the number of bits
 * it can decode.
 */
function boundedDecoder(decoder, bitCount) {
    if (bitCount === undefined || bitCount < 0) {
        // no bounds - just use the existing encoder
        return decoder;
    }
    return {
        decodeBit(p) {
            assert(bitCount > 0, 'Stream has ended');
            bitCount--;
            return decoder.decodeBit(p);
        },
        close() {
            decoder.close();
        },
        isClosed() {
            return bitCount <= 0 || decoder.isClosed();
        },
    };
}
/**
 * Implementation class for ArithmeticDecoder.
 *
 * The implementation was inspired (and heavily assisted) by the guide at
 * https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html
 *
 * We use floating point arithmetic rather than the integer stuff presented
 * there. The code is simpler, more efficient within JavaScript, and is
 * completely stable (i.e. no rounding error issues) as long as we continue
 * to keep the windows in the encoder and decoder consistent. To help with this,
 * the zoom window is kept between 1.0 and 2.0 (rather than the more obvious
 * 0.0 and 1.0). This is due to the IEEE 754 `binary64` encoding; all values
 * in the range [1.0, 2.0) use the same exponent, and have a consistent 52 bits
 * of information. This allows us to handle the zoom-in and mid-range
 * calculations without worrying about rounding errors.
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
class ArithmeticDecoderImpl {
    input;
    padStream;
    closed = false;
    high = 2.0;
    low = 1.0;
    value = 1.0;
    valueRange = 1.0;
    constructor(input, padStream = false) {
        this.input = input;
        this.padStream = padStream;
    }
    decodeBit(p) {
        assert(!this.closed, 'Stream closed');
        while (this.high - this.low <= 0.25) {
            let zoom;
            if (this.high <= 1.5) {
                this.high = (this.high - 0.5) * 2.0;
                this.value = (this.value - 0.5) * 2.0;
                this.low = (this.low - 0.5) * 2.0;
                zoom = 'low';
            }
            else if (this.low >= 1.5) {
                this.high = (this.high - 1.0) * 2.0;
                this.value = (this.value - 1.0) * 2.0;
                this.low = (this.low - 1.0) * 2.0;
                zoom = 'high';
            }
            else {
                this.high = (this.high - 0.75) * 2.0;
                this.value = (this.value - 0.75) * 2.0;
                this.low = (this.low - 0.75) * 2.0;
                zoom = 'mid';
            }
            this.valueRange *= 2;
            trace('[Arithmetic.decode] zooming %o', () => ({
                zoom,
                low: this.low,
                high: this.high,
                value: this.value,
                valueRange: this.valueRange,
            }));
        }
        const mid = calcMid(this.low, this.high, p, 'decode');
        const logData = () => {
            return {
                low: this.low,
                mid,
                high: this.high,
                value: this.value,
                valueRange: this.valueRange,
                p,
            };
        };
        trace('[Arithmetic.decode] working on: %o', logData);
        for (;;) {
            if (this.value >= mid) {
                trace('[Arithmetic.decode] emitting 1 bit. Data: %o', logData);
                this.low = mid;
                return 1;
            }
            else if (this.value + this.valueRange <= mid) {
                trace('[Arithmetic.decode] emitting 0 bit. Data: %o', logData);
                this.high = mid;
                return 0;
            }
            else {
                if (!this.padStream && this.input.isClosed()) {
                    this.closed = true;
                    assert(false, 'No more bits in the stream');
                }
                const bit = this.padStream && this.input.isClosed() ? 0 : this.input.read();
                this.valueRange /= 2;
                this.value += bit * this.valueRange;
                trace('[Arithmetic.decode] Reading more. Data: %o', () => ({
                    bit,
                    ...logData(),
                }));
            }
        }
    }
    close() {
        this.closed = true;
    }
    isClosed() {
        return this.closed;
    }
}
/**
 * Implementation class for ArithmeticEncoder. See ArithmeticDecoder for
 * general information on implementation details.
 */
class ArithmeticEncoderImpl {
    output;
    closed = false;
    high = 2.0;
    low = 1.0;
    // the number of bits bending resolution to the 01111.. vs 1000.. status
    pendingBits = 0;
    // the number of trailing zeros. This is used to pro-actively trim the
    // trailing zeros when `terminateStream` is false
    trailingZeros = 0;
    constructor(output, state) {
        this.output = output;
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
    encodeBit(p, b) {
        assert(!this.closed, 'Stream closed');
        while (this.high - this.low <= 0.25) {
            if (this.high <= 1.5) {
                this.zoomLow('encode');
            }
            else if (this.low >= 1.5) {
                this.zoomHigh('encode');
            }
            else {
                this.zoomMid('encode');
            }
        }
        const mid = calcMid(this.low, this.high, p, 'encode');
        trace('[Arithmetic.encode] working on: %o', () => ({
            low: this.low,
            mid,
            high: this.high,
            p,
            b,
        }));
        if (b) {
            assert(mid < this.high, '[Arithmetic.encode] Invalid p == 1 with b === 1');
            this.low = mid;
        }
        else {
            assert(mid > this.low, '[Arithmetic.encode] Invalid p == 0 with b === 0');
            this.high = mid;
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
    close(terminateStream = false) {
        if (!this.closed) {
            this.closed = true;
            if (terminateStream) {
                while (this.high < 2.0 || this.low > 1.0) {
                    if (this.low > 1.0 && this.high >= 1.75) {
                        this.zoomHigh('terminating');
                    }
                    else if (this.high < 2.0 && this.low <= 1.25) {
                        this.zoomLow('terminating');
                    }
                    else {
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
            }
            else {
                // different approach when not terminating - just find a viable
                // candidate with the fewest number of bits
                while (this.low > 1.0 || this.pendingBits) {
                    if (this.high > 1.5) {
                        this.zoomHigh('closing');
                    }
                    else {
                        this.zoomLow('closing');
                    }
                }
            }
        }
    }
    /** Returns true if this encoder is closed. */
    isClosed() {
        return this.closed;
    }
    clone(writer) {
        return new ArithmeticEncoderImpl(writer, {
            closed: this.closed,
            high: this.high,
            low: this.low,
            pendingBits: this.pendingBits,
            trailingZeros: this.trailingZeros,
        });
    }
    zoomHigh(debug) {
        this.writeBit(1);
        this.high = (this.high - 1.0) * 2.0;
        this.low = (this.low - 1.0) * 2.0;
        trace('[Arithmetic.zoom] %s %o', debug, () => ({
            zoom: 'high',
            low: this.low,
            high: this.high,
        }));
    }
    zoomLow(debug) {
        this.writeBit(0);
        this.high = (this.high - 0.5) * 2.0;
        this.low = (this.low - 0.5) * 2.0;
        trace('[Arithmetic.zoom] %s %o', debug, () => ({
            zoom: 'low',
            low: this.low,
            high: this.high,
        }));
    }
    zoomMid(debug) {
        this.pendingBits++;
        this.high = (this.high - 0.75) * 2.0;
        this.low = (this.low - 0.75) * 2.0;
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
    writeBit(bit) {
        if (bit) {
            for (; this.trailingZeros; --this.trailingZeros)
                this.output.write(0);
            this.output.write(1);
            this.trailingZeros = this.pendingBits;
            this.pendingBits = 0;
        }
        else {
            if (this.pendingBits) {
                for (; this.trailingZeros >= 0; --this.trailingZeros) {
                    this.output.write(0);
                }
                for (; this.pendingBits; --this.pendingBits)
                    this.output.write(1);
            }
            ++this.trailingZeros;
        }
    }
}
/**
 * To ensure the encoder and decoder do the same exact work, the mid-point
 * calculation is pulled out here.
 */
function calcMid(low, high, p, debug) {
    // Note: low and high are both between 1 and 2, so both are using the same
    // double exponent. This means we can do the operations below while
    // keeping 2.0 <= mid <= 1.0  (i.e. we don't have to worry about rounding
    // error within the `high - low` portion)
    const mid = low + p * (high - low);
    if (mid >= high || isNaN(mid)) {
        if (mid === high) {
            return p < 1.0 ? high - Number.EPSILON : high;
        }
        else {
            throw new Error(`[Arithmetic.${debug}] Invalid probablility from model: ${p}`);
        }
    }
    // same - catching NaN with !(mid > low)
    if (mid <= low || isNaN(mid)) {
        if (mid === low) {
            return p > 0.0 ? low + Number.EPSILON : low;
        }
        else {
            throw new Error(`[Arithmetic.${debug}] Invalid probablility from model: ${p}`);
        }
    }
    return mid;
}
/** Helper function for creating an ArithmeticModel */
function generateModelTree(symbols) {
    assert(symbols.length, 'Need at least one item to construct the Model');
    function indexItem(item, root) {
        assert(item.value.length, 'Empty value');
        assert(item.weight >= 0, 'Weights must not be negative');
        if (item.weight === 0) {
            return;
        }
        let node = root;
        for (let i = 0; i < item.value.length; i++) {
            const bit = item.value.getBit(i);
            node.weights[bit] += item.weight;
            let child = (node.children[bit] = node.children[bit] ?? {
                weights: [0, 0],
                children: [undefined, undefined],
                isLeaf: false,
            });
            assert(!child.isLeaf, 'Common prefix: ' +
                item.value.getBigBits(0, i).toString(2) +
                ' is a prefix for ' +
                item.value.toBigInt().toString(2));
            node = child;
        }
        assert(!node.weights[0] && !node.weights[0], 'Indexing item is a prefix of one or more other items: ' +
            item.value.toBigInt().toString(2));
        node.isLeaf = true;
    }
    // Normalize the weights and fill in empty nodes
    function normalizeTree(node) {
        if (!node || node.isLeaf) {
            return undefined;
        }
        const p = node.weights[0] / (node.weights[0] + node.weights[1]);
        const children = [
            normalizeTree(node.children[0]),
            normalizeTree(node.children[1]),
        ];
        return { p, children };
    }
    const root = {
        isLeaf: false,
        weights: [0, 0],
        children: [undefined, undefined],
    };
    for (const item of symbols) {
        indexItem(item, root);
    }
    return normalizeTree(root);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJpdGhtZXRpYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2NvbXByZXNzaW9uL2FyaXRobWV0aWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUVMLE1BQU0sRUFDTixZQUFZLEVBR1osU0FBUyxHQUNWLE1BQU0sVUFBVSxDQUFDO0FBQ2xCLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDdEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUV0Qzs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sVUFBVTtJQUNyQixtQ0FBbUM7SUFDbkMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFpQjtRQUM5QixPQUFPLElBQUkscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVELE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBa0IsRUFBRSxTQUFtQjtRQUNwRCxPQUFPLElBQUkscUJBQXFCLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7Q0FDRjtBQWdHRCx3RUFBd0U7QUFDeEUsTUFBTSxPQUFPLGVBQWU7SUFHVCxJQUFJLENBQU87SUFFNUIsWUFBWSxPQUEyQjtRQUNyQyxJQUFJLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCx3Q0FBd0M7SUFDeEMsTUFBTSxDQUFDLEtBQWdCLEVBQUUsT0FBMEI7UUFDakQsSUFBSSxJQUFJLEdBQVMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUMzQixTQUFTLENBQUM7WUFDUixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDekIsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQy9CLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FB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