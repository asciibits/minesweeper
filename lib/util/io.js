import { assert } from './assert.js';
import { asIterator, countBits } from './utils.js';
/** Use a Reader object as an Iterator of bits */
export function* biterator(input) {
    yield* iterator(input);
}
/** Use a Reader object as an Iterator of bytes */
export function* byterator(input) {
    yield* interator(input, 8);
}
/** Use a Reader object as an Iterator of bits */
export function* interator(input, bitsPerVal = 32) {
    assert(bitsPerVal > 0 && bitsPerVal <= 32, 'Bit count must be > 0 and <= 32');
    while (!input.isClosed()) {
        const bitsRemaining = input.count();
        yield input.readBatch(bitsRemaining < 0 || bitsRemaining >= bitsPerVal
            ? bitsPerVal
            : bitsRemaining);
    }
}
export function* iterator(reader) {
    while (!reader.isClosed()) {
        yield reader.read();
    }
}
class EmptyReader {
    read() {
        throw new Error('End of stream');
    }
    readBatch() {
        throw new Error('End of stream');
    }
    maxBatch() {
        return 1;
    }
    readBigBits() {
        throw new Error('End of stream');
    }
    count() {
        return 0;
    }
    pending() {
        return 0;
    }
    close() { }
    isClosed() {
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
export class BitSet {
    // a series of 32-bit values holding the bits.
    bits;
    // Backing value for the length property
    _length = 0;
    constructor(bits, bitCount) {
        this.bits = Array.isArray(bits) ? bits : bits ? [bits] : [];
        this._length = this.bits.length * 32;
        if (bitCount !== undefined && bitCount !== this._length) {
            this.length = bitCount;
        }
    }
    static fromBigint(value) {
        const result = new BitSet();
        result.setBigBits(value, 0);
        return result;
    }
    static fromReader(reader, bitCount) {
        if (reader instanceof BitSetReader) {
            reader.close();
            return reader.bitset;
        }
        bitCount = bitCount ?? -1;
        const result = new BitSet();
        const writer = result.toWriter();
        function getBitsToWrite() {
            return bitCount < 0
                ? reader.pending()
                : bitCount > 0
                    ? Math.min(bitCount, reader.pending())
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
    get length() {
        return this._length;
    }
    set length(val) {
        assert(val >= 0, 'Length must be positive');
        const numbersNeeded = (val + 31) >>> 5;
        if (numbersNeeded > this.bits.length) {
            for (let i = this.bits.length; i < numbersNeeded; i++) {
                this.bits.push(0);
            }
        }
        else {
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
    trim() {
        // find last non-zero buffer value
        let i;
        for (i = this.bits.length; i > 0 && !this.bits[i - 1]; --i)
            ;
        this.bits.length = i;
        this._length = this.bits.length
            ? (this.bits.length << 5) - Math.clz32(this.bits[this.bits.length - 1])
            : 0;
        return this;
    }
    getBit(index) {
        assert(index >= 0, 'Index out of range');
        if (index >= this._length)
            return 0;
        const { bytePos, bitPos } = getPosition(index);
        return ((this.bits[bytePos] >>> bitPos) & 1);
    }
    setBit(index, val = 1) {
        assert(index >= 0, 'Index out of range');
        if (this._length <= index) {
            // use 'length' not '_length' to get the side effects
            this.length = index + 1;
        }
        const { bytePos, bitPos } = getPosition(index);
        const mask = 1 << bitPos;
        if (val) {
            this.bits[bytePos] |= mask;
        }
        else {
            this.bits[bytePos] &= ~mask;
        }
    }
    appendBit(val = 1) {
        this.setBit(this._length, val);
    }
    clearBit(index) {
        this.setBit(index, 0);
    }
    getBits(start, end) {
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
        const { bytePos, bitPos } = getPosition(start);
        if (bitPos === 0 && bitCount === 32) {
            // performance short circuit
            return this.bits[bytePos];
        }
        if (bitPos + bitCount <= 32) {
            return (this.bits[bytePos] >>> bitPos) & (0xffffffff >>> -bitCount);
        }
        else {
            // combine the two bytes, shifted and masked to include the requested bits
            return (((this.bits[bytePos] >>> bitPos) |
                (this.bits[bytePos + 1] << -bitPos)) &
                (0xffffffff >>> -bitCount));
        }
    }
    setBits(val, start, end) {
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
        const { bytePos, bitPos } = getPosition(start);
        if (bitPos + bitCount <= 32) {
            const mask = (0xffffffff >>> -bitCount) << bitPos;
            // single buffer
            this.bits[bytePos] =
                (this.bits[bytePos] & ~mask) | ((val << bitPos) & mask);
        }
        else {
            this.bits[bytePos] =
                (this.bits[bytePos] & (0xffffffff >>> -bitPos)) | (val << bitPos);
            const mask = 0xffffffff << (bitPos + bitCount);
            this.bits[bytePos + 1] =
                (this.bits[bytePos + 1] & mask) | ((val >> -bitPos) & ~mask);
        }
    }
    appendBits(val, bitCount) {
        if (typeof val === 'bigint') {
            this.appendBigBits(val, bitCount);
            return;
        }
        bitCount = bitCount ?? 32;
        assert(bitCount >= 0 && bitCount <= 32, 'bitCount must be between 0 and 32');
        return this.setBits(val, this._length, this._length + bitCount);
    }
    getBigBits(start, end) {
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
        const { bytePos, bitPos } = getPosition(start);
        if (bitPos + bitCount <= 32) {
            // short circuit for single buffer
            return BigInt(((this.bits[bytePos] >>> bitPos) & (0xffffffff >>> -bitCount)) >>> 0);
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
    setBigBits(val, start, end) {
        assert(start >= 0 && (end === undefined || end >= start), 'start or end out of range');
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
        let { bytePos, bitPos } = getPosition(start);
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
        while (end ? end - start > 32 : this._length - start > 32 || val > 0xffffffff) {
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
    appendBigBits(val, bitCount) {
        return this.setBigBits(val, this._length, bitCount === undefined ? bitCount : this._length + bitCount);
    }
    countBits() {
        return this.bits.reduce((t, v) => t + countBits(v), 0);
    }
    shift(count) {
        if (count < 0) {
            count = -count;
            const offset = count >>> 5;
            const shift = count & 0b11111;
            if (shift === 0) {
                // short circuit
                for (let i = 0; i < this.bits.length - offset; i++) {
                    this.bits[i] = this.bits[i + offset];
                }
            }
            else {
                let i = 0;
                for (; i < this.bits.length - offset - 1; i++) {
                    this.bits[i] =
                        (this.bits[i + offset] >>> shift) |
                            (this.bits[i + offset + 1] << -shift);
                }
                this.bits[i] = this.bits[i + offset] >>> shift;
            }
            this.length -= count;
        }
        else if (count > 0) {
            const offset = count >>> 5;
            const shift = count & 0b11111;
            this.length += count + 32;
            if (shift === 0) {
                // short circuit
                for (let i = this.bits.length - 1; i >= offset; i--) {
                    this.bits[i] = this.bits[i - offset];
                }
            }
            else {
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
    toBigInt(start = 0) {
        return this.getBigBits(start, this._length);
    }
    toReader(start, end) {
        return new BitSetReader(this, start, end);
    }
    toWriter(start, end) {
        return new BitSetWriter(this, start, end);
    }
    /**
     * Make a copy of this BitSet.
     */
    clone() {
        return new BitSet([...this.bits], this._length);
    }
    [Symbol.iterator]() {
        return biterator(this.toReader());
    }
    toString(radix = 2) {
        const r = this.toBigInt().toString(radix);
        return ('0'.repeat(Math.max(Math.trunc(Math.log(2 ** this.length) / Math.log(radix)) - r.length, 0)) + r);
    }
}
/** Return the byte and bit position of a given bit-index */
function getPosition(index) {
    return {
        bytePos: index >>> 5,
        bitPos: index & 0b11111,
    };
}
/**
 * An abstract Reader that handles all details except
 */
export class AbstractBitReader {
    bitsAvailable;
    done = false;
    constructor(bitsAvailable = -1) {
        this.bitsAvailable = bitsAvailable;
    }
    read() {
        assert(!this.done, 'End of stream');
        this.bitsAvailable--;
        return this.getBits(1);
    }
    readBatch(bitCount = 32) {
        if (bitCount === 0) {
            return 0;
        }
        assert(!this.done, 'End of stream');
        assert(bitCount >= 0 && bitCount <= 32, 'bitCount must be between 0 and 32 inclusive');
        try {
            this.bitsAvailable -= bitCount;
            return this.getBits(bitCount);
        }
        catch (e) {
            this.bitsAvailable = 0;
            this.done = true;
            throw e;
        }
    }
    readBigBits(bitCount) {
        assert(!this.done, 'End of stream');
        bitCount = bitCount ?? -1;
        try {
            let result = 0n;
            let bitsWritten = 0;
            let recommendedReadBits = this.pending();
            while (bitCount < 0 ? recommendedReadBits > 0 : bitCount > bitsWritten) {
                assert(recommendedReadBits > 0, 'End of stream');
                const bitsToWrite = bitCount < 0
                    ? recommendedReadBits
                    : Math.min(bitCount - bitsWritten, recommendedReadBits);
                result |=
                    BigInt(this.getBits(bitsToWrite) >>> 0) << BigInt(bitsWritten);
                bitsWritten += bitsToWrite;
                this.bitsAvailable -= bitsToWrite;
                recommendedReadBits = this.pending();
            }
            return result;
        }
        catch (e) {
            this.bitsAvailable = 0;
            this.done = true;
            throw e;
        }
    }
    maxBatch() {
        return 32;
    }
    count() {
        return this.done ? 0 : this.bitsAvailable < 0 ? -1 : this.bitsAvailable;
    }
    pending() {
        return this.done ? 0 : 1;
    }
    close() {
        this.done = true;
    }
    isClosed() {
        return this.done;
    }
    asBigBitReader() {
        return {
            read: () => this.read(),
            readBatch: (bitCount) => this.readBigBits(bitCount),
            maxBatch: () => 0xffffffff,
            count: () => this.count(),
            pending: () => this.pending(),
            close: () => this.close(),
            isClosed: () => this.isClosed(),
            asBitReader: () => this,
        };
    }
}
/**
 * A Reader backed by a BitSet. This supports starting at an arbitrary point in
 * the BitSet.
 */
export class BitSetReader extends AbstractBitReader {
    bitset;
    end;
    pos;
    constructor(bitset, start = 0, end) {
        super();
        this.bitset = bitset;
        this.end = end;
        assert(start >= 0, 'start must be non-negative');
        assert(end === undefined || end >= start, 'end must be greater than start');
        this.pos = start;
    }
    /** True if this iterator is past the current length of the BitSet */
    isClosed() {
        return this.done || this.pos >= (this.end ?? this.bitset.length);
    }
    /** Get the next number */
    getBits(bitCount) {
        assert(this.pos + bitCount <= (this.end ?? this.bitset.length), 'No data available');
        const start = this.pos;
        this.pos += bitCount;
        return this.bitset.getBits(start, this.pos);
    }
    count() {
        return this.done ? 0 : (this.end ?? this.bitset.length) - this.pos;
    }
    pending() {
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
export class BitSetWriter {
    end;
    bitset;
    pos;
    closed = false;
    constructor(bitset = new BitSet(), start = bitset.length, end) {
        this.end = end;
        assert(start >= 0, 'start must be non-negative');
        assert(end === undefined || end >= start, 'end must be greater than start');
        this.bitset = bitset ?? new BitSet();
        this.pos = start;
    }
    /** True if this iterator is past the current length of the BitSet */
    isClosed() {
        return this.closed || (!!this.end && this.pos >= this.end);
    }
    /** Write a single bit */
    write(bit) {
        this.assertBitCount(1);
        this.bitset.setBit(this.pos, bit);
        this.pos++;
        return this;
    }
    /**
     * Write the low bits of a 32-bit number. If bitCount is not set, 32 bits are
     * written
     */
    writeBatch(val, bitCount) {
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
    writeBigBits(val, bitCount) {
        if (this.end !== undefined && bitCount === undefined) {
            bitCount = this.end - this.pos;
        }
        this.assertBitCount(bitCount ?? 0);
        if (bitCount === undefined) {
            bitCount = this.bitset.setBigBits(val, this.pos);
        }
        else {
            this.bitset.setBigBits(val, this.pos, this.pos + bitCount);
        }
        this.pos += bitCount;
        return this;
    }
    close() {
        this.closed = true;
    }
    assertBitCount(bitCount) {
        assert(!this.closed, 'Stream is closed');
        assert(!this.end || this.pos + bitCount <= this.end, 'End of stream');
    }
    asBigBitWriter() {
        const bigBitWriter = {
            write: value => {
                this.write(value);
                return bigBitWriter;
            },
            writeBatch: (batch, itemCount) => {
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
/**
 * Creates a Reader from a `Bits` generator
 */
export class BitSourceReader extends AbstractBitReader {
    value = 0;
    bitCount = 0;
    source;
    constructor(source, bitCount) {
        super(bitCount);
        if (Array.isArray(source) && bitCount === undefined) {
            // we can calculate the bitCount with an array
            this.bitsAvailable = source.reduce((a, c) => a + c.bitCount, 0);
        }
        this.source = asIterator(source);
    }
    static create(source, bitsPerInput) {
        source = typeof source === 'number' ? [source] : source;
        return new BitSourceReader(source.map(s => ({ value: s, bitCount: bitsPerInput })), bitsPerInput * source.length);
    }
    getBits(bitCount) {
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
        }
        else {
            result |= (this.value & (-1 >>> (bitsWritten - bitCount))) << bitsWritten;
            this.value >>>= bitCount - bitsWritten;
        }
        this.bitCount -= bitCount - bitsWritten;
        return result;
    }
    pending() {
        this.checkSource();
        return this.bitCount;
    }
    count() {
        this.checkSource();
        return super.count();
    }
    isClosed() {
        this.checkSource();
        return this.done;
    }
    checkSource() {
        if (!this.done && this.bitCount === 0) {
            const next = this.source.next();
            if (next.done) {
                this.done = true;
            }
            else {
                assert(next.value.bitCount >= 0 && next.value.bitCount <= 32, 'bitcount must be between 1 and 32 inclusive');
                this.value = next.value.value;
                this.bitCount = next.value.bitCount;
            }
        }
    }
}
class ConcatenatedReader extends AbstractBitReader {
    readers;
    idx = 0;
    constructor(readers) {
        super();
        this.readers = readers;
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
    pending() {
        return this.done ? 0 : this.readers[this.idx].pending();
    }
    getBits(bitCount) {
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
    checkReader() {
        while (this.readers[this.idx]?.isClosed()) {
            this.idx++;
        }
        if (this.idx >= this.readers.length) {
            this.done = true;
        }
    }
}
export function concatenateReaders(readers) {
    return new ConcatenatedReader(readers);
}
export function copy(source, destination, bitCount) {
    bitCount = bitCount ?? Number.MAX_VALUE;
    const maxBatch = source.maxBatch();
    let readItems = Math.min(maxBatch, Math.min(bitCount, source.pending()));
    while (readItems > 0) {
        destination.writeBatch(source.readBatch(readItems), readItems);
        readItems = Math.min(maxBatch, Math.min(bitCount, source.pending()));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbC9pby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3JDLE9BQU8sRUFBWSxVQUFVLEVBQUUsU0FBUyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBbUc3RCxpREFBaUQ7QUFDakQsTUFBTSxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBZ0I7SUFDekMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBbUIsQ0FBQztBQUMzQyxDQUFDO0FBRUQsa0RBQWtEO0FBQ2xELE1BQU0sU0FBUyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQWdCO0lBQ3pDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVELGlEQUFpRDtBQUNqRCxNQUFNLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FDeEIsS0FBZ0IsRUFDaEIsVUFBVSxHQUFHLEVBQUU7SUFFZixNQUFNLENBQUMsVUFBVSxHQUFHLENBQUMsSUFBSSxVQUFVLElBQUksRUFBRSxFQUFFLGlDQUFpQyxDQUFDLENBQUM7SUFDOUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO1FBQ3pCLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNwQyxNQUFNLEtBQUssQ0FBQyxTQUFTLENBQ25CLGFBQWEsR0FBRyxDQUFDLElBQUksYUFBYSxJQUFJLFVBQVU7WUFDOUMsQ0FBQyxDQUFDLFVBQVU7WUFDWixDQUFDLENBQUMsYUFBYSxDQUNsQixDQUFDO0lBQ0osQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBSSxNQUFpQjtJQUM1QyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7UUFDMUIs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