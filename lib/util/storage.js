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
        const bitsRemaining = input.count();
        return this.decodeBitSet(input, bitsRemaining < 0 ? 128 : bitsRemaining).toBigInt();
    }
    decodeBitSet(input, initialCapacity = 64) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdUVBQXVFO0FBRXZFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUNMLE1BQU0sRUFDTixZQUFZLEdBTWIsTUFBTSxTQUFTLENBQUM7QUFDakIsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGNBQWMsQ0FBQztBQXlCckMsb0RBQW9EO0FBQ3BELE1BQU0sVUFBVSxjQUFjLENBQzVCLEtBQVEsRUFDUixLQUFlLEVBQ2YsTUFBTSxHQUFHLElBQUksTUFBTSxFQUFFO0lBRXJCLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sT0FBTywyQkFBMkI7SUFDakI7SUFBckIsWUFBcUIsV0FBbUI7UUFBbkIsZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFDdEMsTUFBTSxDQUNKLFdBQVcsR0FBRyxDQUFDLElBQUksV0FBVyxHQUFHLEVBQUUsRUFDbkMsbUNBQW1DLENBQ3BDLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxDQUFDLEdBQVcsRUFBRSxNQUFpQjtRQUNuQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBQ0QsWUFBWSxDQUFDLEdBQVcsRUFBRSxNQUFpQjtRQUN6QyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksWUFBWSxFQUFFLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBQ08sWUFBWSxD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Q0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztvQkFDcEQsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3JELENBQUM7Z0JBQ0QsT0FBTyxNQUFNLENBQUM7WUFDaEIsQ0FBQztRQUNILENBQUM7UUFFRCxzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDWCxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ25DLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbkMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsT0FBTztvQkFDTCxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUU7b0JBQ2xDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUU7b0JBQzNDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxJQUFJLEVBQUU7b0JBQzNDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxFQUFFO2lCQUNyRCxDQUFDO1lBQ0osQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbkMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsT0FBTztvQkFDTCxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO29CQUN4QixFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUMsRUFBRTtpQkFDbEMsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNuQyxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25CLE9BQU87Z0JBQ0wsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRTtnQkFDeEIsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksR0FBRyxJQUFJLEVBQUU7YUFDbEMsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0lBRUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBRS9DLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBRTNDLG9EQUFvRDtJQUNwRCxNQUFNLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztJQUUxQixPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIn0=