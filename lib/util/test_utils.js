import { BitSet, BitSetWriter } from './io.js';
export function cleanState(init) {
    const state = {};
    beforeEach(() => {
        // clear state before every test case.
        for (const prop of Object.getOwnPropertyNames(state)) {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            delete state[prop];
            /* eslint-enable @typescript-eslint/no-explicit-any */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdF91dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL3Rlc3RfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQWEsTUFBTSxTQUFTLENBQUM7QUFFMUQsTUFBTSxVQUFVLFVBQVUsQ0FDeEIsSUFBYTtJQUViLE1BQU0sS0FBSyxHQUFHLEVBQWtCLENBQUM7SUFDakMsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLHNDQUFzQztRQUN0QyxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3JELHVEQUF1RDtZQUN2RCxPQUFRLEtBQThCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0Msc0RBQXNEO1FBQ3hELENBQUM7UUFDRCxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQy9CLENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBWUQsTUFBTSxVQUFVLE1BQU0sQ0FDcEIsTUFBOEMsRUFDOUMsY0FBdUIsRUFDdkIsUUFBaUI7SUFFakIsSUFBSSxNQUFjLENBQUM7SUFDbkIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7UUFDMUIsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO1FBQ3BDLE1BQU0sTUFBTSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7UUFDbEMsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUMzQixNQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBQ0QsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDekIsQ0FBQztTQUFNLENBQUM7UUFDTixRQUFRLEdBQUcsY0FBYyxDQUFDO1FBQzFCLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDL0IsTUFBTSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUN4RCxDQUFDO2FBQU0sSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN0QyxNQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzFELENBQUM7YUFBTSxDQUFDO1lBQ04sMkJBQTJCO1lBQzNCLE1BQU0sR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMvQyxDQUFDO0lBQ0gsQ0FBQztJQUNELElBQUksUUFBUSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzNCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDO0lBQzNCLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIn0=