import { assert } from '../assert.js';
import { BitSet, BitSetWriter } from '../io.js';
import { reverseBits } from '../utils.js';
export class HuffmanEncoder {
    huffmanModel;
    input;
    constructor(huffmanModel, input) {
        this.huffmanModel = huffmanModel;
        this.input = input;
    }
    next() {
        if (this.input.isClosed()) {
            return {
                value: undefined,
                done: true,
            };
        }
        let model = this.huffmanModel;
        while (Array.isArray(model)) {
            model = model[this.input.read()];
        }
        return {
            value: model,
            done: false,
        };
    }
    [Symbol.iterator]() {
        return this;
    }
}
export function encodeHuffman(input, model, output) {
    const bitset = output ? undefined : new BitSet();
    output = output ?? new BitSetWriter(bitset);
    for (const code of new HuffmanEncoder(model, input)) {
        const { value, bitCount } = code;
        output.writeBatch(value, bitCount);
    }
    return bitset;
}
export function generateHuffmanCode(weightedSymbols) {
    assert(weightedSymbols.length > 1, 'Need more than one symbol to construct Huffman model');
    // ideally this would be a priority queue, but for our work, a sorted list
    // will be fine. Especially since there will be at most one value out of
    // order, which makes re-sorting and inserting O(n) assuming a simple
    // insertion sort.
    const nodes = [...weightedSymbols].sort(compareByWeight);
    while (nodes.length > 1) {
        const left = nodes[nodes.length - 1];
        const right = nodes[nodes.length - 2];
        const weight = left.weight + right.weight;
        nodes.length -= 2;
        nodes.push({
            left,
            right,
            weight,
        });
        nodes.sort(compareByWeight);
    }
    // We could build the HuffmanModep directly from nodes, but we want to
    // generate the canonical codes
    // (https://en.wikipedia.org/wiki/Canonical_Huffman_code) which requires a
    // bit more processing.
    const mappings = [];
    function getSymbolPairs(node, depth = 0) {
        if (isNode(node)) {
            getSymbolPairs(node.left, depth + 1);
            getSymbolPairs(node.right, depth + 1);
        }
        else {
            // use value 0 for now - it will be updated with a canonical value after
            mappings.push([
                { value: node.value, bitCount: node.bitCount },
                { value: 0, bitCount: depth },
            ]);
        }
    }
    getSymbolPairs(nodes[0]);
    function compareByBitCount(a, b) {
        let comp = a[1].bitCount - b[1].bitCount;
        if (!comp) {
            comp = (reverseBits(a[0].value) >>> 1) - (reverseBits(b[0].value) >>> 1);
        }
        return comp;
    }
    mappings.sort(compareByBitCount);
    let value = 0;
    let bitCount = 0;
    for (const pair of mappings) {
        value <<= pair[1].bitCount - bitCount;
        bitCount = pair[1].bitCount;
        pair[1].value = reverseBits(value) >>> -bitCount;
        value++;
    }
    return constructHuffmanCode(mappings);
}
function isNode(val) {
    return !!val.left;
}
function compareByWeight(a, b) {
    return b.weight - a.weight;
}
export function constructHuffmanCode(mappings) {
    const encode = constructHuffmanModel(mappings);
    const decode = constructHuffmanModel(mappings.map(p => [p[1], p[0]]));
    return { encode, decode };
}
function constructHuffmanModel(mappings) {
    const huffmanModel = [undefined, undefined];
    for (const symbolPair of mappings) {
        const [input, code] = symbolPair;
        let model = huffmanModel;
        for (let i = 0; i < input.bitCount - 1; i++) {
            const idx = (input.value >>> i) & 1;
            let next = model[idx];
            if (!next) {
                model[idx] = next = [undefined, undefined];
            }
            else if (!Array.isArray(next)) {
                throw new Error(`Found conflicting encode values. 0b${symbolToString({ value: input.value & ((1 << i) - 1), bitCount: i })} is a prefix for 0b${symbolToString(input)}.`);
            }
            model = next;
        }
        const idx = (input.value >>> (input.bitCount - 1)) & 1;
        if (model[idx]) {
            throw new Error(`Found conflicting encode values. 0b${symbolToString(input)} is a prefix for another value.`);
        }
        model[idx] = code;
    }
    function assertFullTree(model, prefix = '') {
        for (const i of [0, 1]) {
            const child = model[i];
            if (!child) {
                throw new Error(`Incomplete tree. No code for prefix: ${prefix}${i}.`);
            }
            else if (Array.isArray(child)) {
                assertFullTree(child, prefix + i);
            }
        }
    }
    assertFullTree(huffmanModel);
    return huffmanModel;
}
function symbolToString(symbol) {
    function padZeros(val, len) {
        return '0'.repeat(Math.max(len - val.length, 0)) + val;
    }
    return padZeros(symbol.value.toString(2), symbol.bitCount);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHVmZm1hbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy91dGlsL2NvbXByZXNzaW9uL2h1ZmZtYW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN0QyxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBd0IsTUFBTSxVQUFVLENBQUM7QUFDdEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQWtCMUMsTUFBTSxPQUFPLGNBQWM7SUFJTjtJQUNBO0lBRm5CLFlBQ21CLFlBQTBCLEVBQzFCLEtBQWdCO1FBRGhCLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQzFCLFVBQUssR0FBTCxLQUFLLENBQVc7SUFDaEMsQ0FBQztJQUVKLElBQUk7UUFDRixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztZQUMxQixPQUFPO2dCQUNMLEtBQUssRUFBRSxTQUFTO2dCQUNoQixJQUFJLEVBQUUsSUFBSTthQUNYLENBQUM7UUFDSixDQUFDO1FBQ0QsSUFBSSxLQUFLLEdBQWlDLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDNUQsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDNUIsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELE9BQU87WUFDTCxLQUFLLEVBQUUsS0FBSztZQUNaLElBQUksRUFBRSxLQUFLO1NBQ1osQ0FBQztJQUNKLENBQUM7SUFFRCxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7UUFDZixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQVFELE1BQU0sVUFBVSxhQUFhLENBQzNCLEtBQWdCLEVBQ2hCLEtBQW1CLEVBQ25CLE1BQWtCO0lBRWxCLE1BQU0sTUFBTSxHQUFH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