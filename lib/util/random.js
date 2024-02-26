import { assert } from './assert.js';
// export class RandomOrgBitSource implements BitSource {
//   const
//   constructor() {}
//   getLotsOfBits() {
//     const request = new XMLHttpRequest();
//     request.open(
//       'GET',
//       'https://www.random.org/cgi-bin/randbyte?nbytes=256&format=b',
//       false
//     );
//     request.send(null);
//     return request.responseText();
//   }
// }
/**
 * The default, high(er) quality source of randomness
 */
export class CryptoRandomBitSource {
    nextIntegers = new Uint32Array(16);
    nextIndex = 16;
    next() {
        if (this.nextIndex >= this.nextIntegers.length) {
            crypto.getRandomValues(this.nextIntegers);
            this.nextIndex = 0;
        }
        return this.nextIntegers[this.nextIndex++];
    }
}
/**
 * Provide generalized random values from a bit source.
 */
export class Random {
    bitSource;
    workingBits = 0;
    availableBits = 0;
    constructor(bitSource = new CryptoRandomBitSource()) {
        this.bitSource = bitSource;
    }
    getRandomBits(bitCount) {
        assert(bitCount >= 0 && bitCount <= 32, 'Random bits must be between 0 and 32');
        if (bitCount === 32) {
            // short-circuit the 32-bit request for both efficiency, and to elimintate
            // the concern about the shift operator being modded by 32
            return this.bitSource.next() >>> 0;
        }
        let result = 0;
        if (this.availableBits < bitCount) {
            // Grab the available bits for the high-order, then get more later for the
            // low-order
            result = this.workingBits << (bitCount - this.availableBits);
            bitCount -= this.availableBits;
            this.workingBits = this.bitSource.next() >>> 0;
            this.availableBits = 32;
        }
        result |= this.workingBits >>> (this.availableBits - bitCount);
        this.availableBits -= bitCount;
        this.workingBits &= (0x1 << this.availableBits) - 1;
        return result;
    }
    getRandomInteger(max, min = 0) {
        assert(min <= max, 'Min must be <= max');
        max -= min;
        const bitCount = boundingLog2(max);
        let result;
        do {
            result = this.getRandomBits(bitCount);
        } while (result >= max);
        return result + min;
    }
    getRandomBigBits(bitLength) {
        assert(bitLength >= 0, 'BitLength must be positive');
        let result = 0n;
        while (bitLength > 32) {
            result = (result << 32n) | BigInt(this.getRandomBits(32));
            bitLength -= 32n;
        }
        result =
            (result << BigInt(bitLength)) |
                BigInt(this.getRandomBits(Number(bitLength)));
        return result;
    }
    getRandomBigInteger(max, min = 0n) {
        assert(min <= max, 'Min must be >= 0 and <= max');
        max -= min;
        const bitCount = boundingLog2(max);
        let result;
        do {
            result = this.getRandomBigBits(bitCount);
        } while (result >= max);
        return result + min;
    }
    /**
     * Generates a random double using 52 bits, evenly distributed between zero
     * and one
     */
    getRandomDouble() {
        const b = new ArrayBuffer(8);
        const iv = new Uint32Array(b);
        iv[0] = this.getRandomBits(32);
        iv[1] = this.getRandomBits(20) | 0x3ff00000;
        return new Float64Array(b)[0] - 1.0;
    }
}
/**
 * Choose `count` random items from an array. Note: The provided `items` array
 * is itself reordered and trimmed to provided the seleciton. Callers should
 * make a copy if the original items needs to be preserved.
 *
 * Calling with `count` equal to `items.length` is a shuffle.
 */
export function choose(items, count = items.length, rand = random) {
    for (let i = 0; i < count; i++) {
        const swapIdx = rand.getRandomInteger(items.length, i);
        if (i != swapIdx) {
            const temp = items[i];
            items[i] = items[swapIdx];
            items[swapIdx] = temp;
        }
    }
    items.length = count;
    return items;
}
function boundingLog2(n) {
    if (typeof n === 'number') {
        return (32 - Math.clz32(n - 1));
    }
    // this isn't great, but it gets the job done
    return BigInt((n - 1n).toString(2).length);
}
/**
 * Useful for tests that initialize Javascripts standard seed
 */
export class RandomBitSource {
    random;
    constructor(seed) {
        seed = (seed ?? Date.now()) & 0xffffffff;
        console.log('Using Test seed: %d', seed);
        this.random = getRandomFunction(seed);
    }
    next() {
        return Math.trunc(this.random() * 0xffffffff);
    }
}
function getRandomFunction(seed) {
    seed ^= 0xdeadbeef; // 32-bit seed with XOR value
    // Pad seed with Phi, Pi and E.
    // https://en.wikipedia.org/wiki/Nothing-up-my-sleeve_number
    const rand = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, seed);
    for (let i = 0; i < 15; i++)
        rand();
    return rand;
}
/**
 * From: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
function sfc32(a, b, c, d) {
    return function () {
        a |= 0;
        b |= 0;
        c |= 0;
        d |= 0;
        const t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}
function jasmineSeed() {
    if (typeof jasmine === 'undefined') {
        return undefined;
    }
    let seed = jasmine?.getEnv()?.configuration()?.seed;
    if (!seed)
        return undefined;
    if (typeof seed === 'string') {
        seed = Number(seed);
    }
    return isNaN(seed) ? undefined : seed;
}
export const random = new Random();
export const testRandom = new Random(new RandomBitSource(jasmineSeed()));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZG9tLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvcmFuZG9tLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFPckMseURBQXlEO0FBQ3pELFVBQVU7QUFDVixxQkFBcUI7QUFDckIsc0JBQXNCO0FBQ3RCLDRDQUE0QztBQUM1QyxvQkFBb0I7QUFDcEIsZUFBZTtBQUNmLHVFQUF1RTtBQUN2RSxjQUFjO0FBQ2QsU0FBUztBQUNULDBCQUEwQjtBQUMxQixxQ0FBcUM7QUFDckMsTUFBTTtBQUNOLElBQUk7QUFFSjs7R0FFRztBQUNILE1BQU0sT0FBTyxxQkFBcUI7SUFDZixZQUFZLEdBQUcsSUFBSSxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztJQUN2QixJQUFJO1FBQ0YsSUFBSSxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDL0MsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDMUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDckIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0Y7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxNQUFNO0lBSUU7SUFIWCxXQUFXLEdBQUcsQ0FBQyxDQUFDO0lBQ2hCLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDMUIsWUFDbUIsWUFBdUIsSUFBSSxxQkFBcUIsRUFBRTtRQUFsRCxjQUFTLEdBQVQsU0FBUyxDQUF5QztJQUNsRSxDQUFDO0lBRUosYUFBYSxDQUFDLFFBQWdCO1FBQzVCLE1BQU0sQ0FDSixRQUFRLElBQUksQ0FBQyxJQUFJLFFBQVEsSUFBSSxFQUFF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