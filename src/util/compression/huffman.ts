import { assert } from '../assert.js';
import { BitSet, BitSetWriter, BitReader, BitWriter } from '../io.js';
import { reverseBits } from '../utils.js';

export interface HuffmanSymbol {
  value: number;
  bitCount: number;
}

export type SymbolPair = [HuffmanSymbol, HuffmanSymbol];

type HuffmanSymbolOrModel = HuffmanSymbol | HuffmanModel;

export type HuffmanModel = [HuffmanSymbolOrModel, HuffmanSymbolOrModel];

export interface HuffmanCode {
  encode: HuffmanModel;
  decode: HuffmanModel;
}

export class HuffmanEncoder
  implements Iterable<HuffmanSymbol>, Iterator<HuffmanSymbol>
{
  constructor(
    private readonly huffmanModel: HuffmanModel,
    private readonly input: BitReader
  ) {}

  next(): IteratorResult<HuffmanSymbol> {
    if (this.input.isClosed()) {
      return {
        value: undefined,
        done: true,
      };
    }
    let model: HuffmanSymbol | HuffmanModel = this.huffmanModel;
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

export function encodeHuffman(
  input: BitReader,
  model: HuffmanModel,
  output: BitWriter
): void;
export function encodeHuffman(input: BitReader, model: HuffmanModel): BitSet;
export function encodeHuffman(
  input: BitReader,
  model: HuffmanModel,
  output?: BitWriter
): BitSet | undefined {
  const bitset = output ? undefined : new BitSet();
  output = output ?? new BitSetWriter(bitset!);
  for (const code of new HuffmanEncoder(model, input)) {
    const { value, bitCount } = code;
    output.writeBatch(value, bitCount);
  }
  return bitset;
}

export interface WeightedHuffmanSymbol extends HuffmanSymbol {
  weight: number;
}

interface GenerateNode {
  weight: number;
  left: SymbolOrNode;
  right: SymbolOrNode;
}
type SymbolOrNode = GenerateNode | WeightedHuffmanSymbol;

export function generateHuffmanCode(
  weightedSymbols: WeightedHuffmanSymbol[]
): HuffmanCode {
  assert(
    weightedSymbols.length > 1,
    'Need more than one symbol to construct Huffman model'
  );
  // ideally this would be a priority queue, but for our work, a sorted list
  // will be fine. Especially since there will be at most one value out of
  // order, which makes re-sorting and inserting O(n) assuming a simple
  // insertion sort.
  const nodes: SymbolOrNode[] = [...weightedSymbols].sort(compareByWeight);
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
  const mappings: SymbolPair[] = [];
  function getSymbolPairs(node: SymbolOrNode, depth = 0) {
    if (isNode(node)) {
      getSymbolPairs(node.left, depth + 1);
      getSymbolPairs(node.right, depth + 1);
    } else {
      // use value 0 for now - it will be updated with a canonical value after
      mappings.push([
        { value: node.value, bitCount: node.bitCount },
        { value: 0, bitCount: depth },
      ]);
    }
  }
  getSymbolPairs(nodes[0]);
  function compareByBitCount(a: SymbolPair, b: SymbolPair): number {
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

function isNode(val: SymbolOrNode): val is GenerateNode {
  return !!(val as GenerateNode).left;
}

function compareByWeight(a: SymbolOrNode, b: SymbolOrNode) {
  return b.weight - a.weight;
}

type PartialHuffmanSymbolOrModel =
  | HuffmanSymbol
  | PartialHuffmanModel
  | undefined;
type PartialHuffmanModel = [
  PartialHuffmanSymbolOrModel,
  PartialHuffmanSymbolOrModel,
];

export function constructHuffmanCode(mappings: SymbolPair[]): HuffmanCode {
  const encode = constructHuffmanModel(mappings);
  const decode = constructHuffmanModel(mappings.map(p => [p[1], p[0]]));
  return { encode, decode };
}

function constructHuffmanModel(mappings: SymbolPair[]): HuffmanModel {
  const huffmanModel: PartialHuffmanModel = [undefined, undefined];
  for (const symbolPair of mappings) {
    const [input, code] = symbolPair;
    let model: PartialHuffmanModel = huffmanModel;
    for (let i = 0; i < input.bitCount - 1; i++) {
      const idx = (input.value >>> i) & 1;
      let next = model[idx];
      if (!next) {
        model[idx] = next = [undefined, undefined];
      } else if (!Array.isArray(next)) {
        throw new Error(
          `Found conflicting encode values. 0b${symbolToString({ value: input.value & ((1 << i) - 1), bitCount: i })} is a prefix for 0b${symbolToString(input)}.`
        );
      }
      model = next;
    }
    const idx = (input.value >>> (input.bitCount - 1)) & 1;
    if (model[idx]) {
      throw new Error(
        `Found conflicting encode values. 0b${symbolToString(input)} is a prefix for another value.`
      );
    }
    model[idx] = code;
  }

  function assertFullTree(
    model: PartialHuffmanModel,
    prefix: string = ''
  ): asserts model is HuffmanModel {
    for (const i of [0, 1]) {
      const child = model[i];
      if (!child) {
        throw new Error(`Incomplete tree. No code for prefix: ${prefix}${i}.`);
      } else if (Array.isArray(child)) {
        assertFullTree(child, prefix + i);
      }
    }
  }
  assertFullTree(huffmanModel);
  return huffmanModel;
}

function symbolToString(symbol: HuffmanSymbol): string {
  function padZeros(val: string, len: number) {
    return '0'.repeat(Math.max(len - val.length, 0)) + val;
  }
  return padZeros(symbol.value.toString(2), symbol.bitCount);
}
