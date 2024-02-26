import { BitSet, BitSetWriter } from './io.js';
export function cleanState(init) {
    const state = {};
    beforeEach(() => {
        // clear state before every test case.
        for (const prop of Object.getOwnPropertyNames(state)) {
            // tslint:disable-next-line:no-any
            delete state[prop];
        }
        Object.assign(state, init());
    });
    return state;
}
export function bitset(source, bitsOrBitCount, bitCount) {
    let bitset;
    if (Array.isArray(source)) {
        const bitsPerDigit = bitsOrBitCount;
        const writer = new BitSetWriter();
        for (const digit of source) {
            writer.writeBatch(digit, bitsPerDigit);
        }
        bitset = writer.bitset;
    }
    else {
        bitCount = bitsOrBitCount;
        if (typeof source === 'number') {
            bitset = new BitSetWriter().writeBatch(source).bitset;
        }
        else if (typeof source === 'bigint') {
            bitset = new BitSetWriter().writeBigBits(source).bitset;
        }
        else {
            // source instanceof Reader
            bitset = BitSet.fromReader(source, bitCount);
        }
    }
    if (bitCount !== undefined) {
        bitset.length = bitCount;
    }
    return bitset;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdF91dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL3Rlc3RfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQWEsTUFBTSxTQUFTLENBQUM7QUFFMUQsTUFBTSxVQUFVLFVBQVUsQ0FBZSxJQUFhO0lBQ3BELE1BQU0sS0FBSyxHQUFHLEVBQWtCLENBQUM7SUFDakMsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLHNDQUFzQztRQUN0QyxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3JELGtDQUFrQztZQUNsQyxPQUFRLEtBQThCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUNELE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0IsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFZRCxNQUFNLFVBQVUsTUFBTSxDQUNwQixNQUE4QyxFQUM5QyxjQUF1QixFQUN2QixRQUFpQjtJQUVqQixJQUFJLE1BQWMsQ0FBQztJQUNuQixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztRQUMxQixNQUFNLFlBQVksR0FBRyxjQUFjLENBQUM7UUFDcEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUNsQyxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQzNCLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3pDLENBQUM7UUFDRCxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUN6QixDQUFDO1NBQU0sQ0FBQztRQUNOLFFBQVEsR0FBRyxjQUFjLENBQUM7UUFDMUIsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUMvQixNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQ3hELENBQUM7YUFBTSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDMUQsQ0FBQzthQUFNLENBQUM7WUFDTiwyQkFBMkI7WUFDM0IsTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQy9DLENBQUM7SUFDSCxDQUFDO0lBQ0QsSUFBSSxRQUFRLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDM0IsTUFBTSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUM7SUFDM0IsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUMifQ==