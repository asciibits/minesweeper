/** This calculates a standard Huffman prefix code for a given input */
import { assert } from './assert.js';
import { BitSet, BitSetWriter, } from './io.js';
import { trace } from './logging.js';
/** Helper function to encode a value to a BitSet */
export function encodeToBitset(input, coder, bitset = new BitSet()) {
    coder.encode(input, bitset.toWriter());
    return bitset;
}
/**
 * An encoder/decoder for VLQ values. See
 * https://en.wikipedia.org/wiki/Variable-length_quantity for details. Unlike
 * standard VLQ that uses 7-bits for `payloadBits`, this encoding allows any
 * positive value.
 */
export class VariableLengthQuantityCoder {
    payloadBits;
    constructor(payloadBits) {
        this.payloadBits = payloadBits;
        assert(payloadBits > 0 && payloadBits < 32, 'Payload bits must be > 0 and < 32');
    }
    encode(val, output) {
        this.encodeBitSet(new BitSetWriter().writeBatch(val).bitset, output);
    }
    encodeBigInt(val, output) {
        this.encodeBitSet(new BitSetWriter().writeBigBits(val).bitset, output);
    }
    encodeBitSet(input, output) {
        input.trim();
        if (!input.length)
            input.length = 1;
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
    decode(input) {
        const output = this.decodeBitSet(input);
        assert(output.length <= 32, "Value too large, can't decode to number. Use the bigint version");
        return output.getBits(0);
    }
    decodeBigInt(input) {
        return this.decodeBitSet(input).toBigInt();
    }
    decodeBitSet(input) {
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
    bigintCoder() {
        return {
            encode: (val, output) => {
                this.encodeBigInt(val, output);
            },
            decode: (input) => this.decodeBigInt(input),
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
export class BitExtendedCoder {
    payloadBits;
    constructor(payloadBits) {
        this.payloadBits = payloadBits;
        assert(payloadBits >= 0 && payloadBits < 32, 'Payload bits must be >= 0 and < 32');
    }
    encode(val, output) {
        this.encodeBitSet(new BitSetWriter().writeBatch(val).bitset, output);
    }
    encodeBigInt(val, output) {
        this.encodeBitSet(new BitSetWriter().writeBigBits(val).bitset, output);
    }
    encodeBitSet(input, output) {
        input.trim();
        if (!input.length)
            input.length = 1;
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
    decode(encoded) {
        const decoded = this.decodeBitSet(encoded);
        assert(decoded.length <= 32, "Value too large, can't decode to number. Use the bigint version");
        return decoded.getBits(0);
    }
    decodeBigInt(encoded) {
        return this.decodeBitSet(encoded).toBigInt();
    }
    decodeBitSet(input) {
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
    bigintCoder() {
        return {
            encode: (val, output) => {
                this.encodeBigInt(val, output);
            },
            decode: (input) => this.decodeBigInt(input),
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
    encode: (decoded) => decoded < 0 ? (~decoded << 1) | 1 : decoded << 1,
    decode: (encoded) => encoded & 1 ? ~(encoded >>> 1) : encoded >>> 1,
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
    base;
    min;
    constructor(base, min = 0) {
        this.base = base;
        this.min = min;
        assert(min <= base);
    }
    static encode(decoded, base, min) {
        return new DeltaCoder(base, min).encode(decoded);
    }
    static decode(encoded, base, min) {
        return new DeltaCoder(base, min).decode(encoded);
    }
    encode(decoded) {
        assert(decoded >= this.min);
        if (decoded >= 2 * (this.base - this.min) + this.min) {
            return decoded - this.min;
        }
        else {
            return InterleaveCoder.encode(decoded - this.base);
        }
    }
    decode(encoded) {
        assert(encoded >= 0);
        if (encoded < 2 * (this.base - this.min)) {
            return InterleaveCoder.decode(encoded) + this.base;
        }
        else {
            return encoded + this.min;
        }
    }
}
export function encodeGrid(input, width, output) {
    output = output ?? new BitSet();
    const outputBitSet = output;
    let outputPos = 0;
    let GridState;
    (function (GridState) {
        GridState[GridState["ALL_ZERO"] = 0] = "ALL_ZERO";
        GridState[GridState["ALL_ONE"] = 1] = "ALL_ONE";
        GridState[GridState["MIXED"] = 2] = "MIXED";
    })(GridState || (GridState = {}));
    /** Delve into a roughly square-ish block and encode the data */
    function delve(grid) {
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
            }
            else if (v === w * h) {
                outputPos = pos;
                outputBitSet.setBits(0b10, outputPos, (outputPos += 2));
                return GridState.ALL_ONE;
            }
            else {
                return GridState.MIXED;
            }
            // do something
        }
        else {
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
            }
            else if (allOneCount === splits.length) {
                outputPos = pos;
                outputBitSet.setBits(0b10, outputPos, (outputPos += 2));
                return GridState.ALL_ONE;
            }
            else {
                return GridState.MIXED;
            }
        }
    }
    function split(rect) {
        const { x, y, w, h } = rect;
        // first check if everything is under 4
        if (w < 4 && h < 4) {
            return [rect];
        }
        // next check for splits to make better squares
        if (h > w) {
            const vSplit = Math.round(h / w);
            if (vSplit > 1) {
                const splits = [];
                for (let i = 0; i < vSplit; i++) {
                    const yStart = y + Math.trunc((i * h) / vSplit);
                    const yEnd = y + Math.trunc(((i + 1) * h) / vSplit);
                    splits.push({ x, y: yStart, w, h: yEnd - yStart });
                }
                return splits;
            }
        }
        else {
            const hSplit = Math.round(w / h);
            if (hSplit > 1) {
                const splits = [];
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
            }
            else {
                const midX = x + Math.trunc(w / 2);
                const endX = x + w;
                return [
                    { x, y, w: midX - x, h },
                    { x: midX, y, w: endX - midX, h },
                ];
            }
        }
        else {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdUVBQXVFO0FBRXZFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUNMLE1BQU0sRUFDTixZQUFZLEdBTWIsTUFBTSxTQUFTLENBQUM7QUFDakIsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGNBQWMsQ0FBQztBQXlCckMsb0RBQW9EO0FBQ3BELE1BQU0sVUFBVSxjQUFjLENBQzVCLEtBQVEsRUFDUixLQUFlLEVBQ2YsTUFBTSxHQUFHLElBQUksTUFBTSxFQUFFO0lBRXJCLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sT0FBTywyQkFBMkI7SUFDakI7SUFBckIsWUFBcUIsV0FBbUI7UUFBbkIsZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFDdEMsTUFBTSxDQUNKLFdBQVcsR0FBRyxDQUFDLElBQUksV0FBVyxHQUFHLEVBQUUsRUFDbkMsbUNBQW1DLENBQ3BDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxDQUFDLEdBQVcsRUFBRSxNQUFpQjtRQUNuQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBQ0QsWUFBWSxDQUFDLEdBQVcsRUFBRSxNQUFpQjtRQUN6QyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBQ08sWUFBWSxD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