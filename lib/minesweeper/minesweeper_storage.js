import { constructHuffmanCode } from '../util/compression/huffman.js';
import { BitSet, BitSetWriter } from '../util/io.js';
import { DeltaCoder } from '../util/storage.js';
import { assert } from '../util/assert.js';
import { CellVisibleState, MineBoard, MineField } from './minesweeper.js';
import { BitExtendedCoder, CountCoder, NumberCoder, } from '../util/compression/arithmetic.js';
import { trace } from '../util/logging.js';
/** The "oppen" state of a cell in a "known" game. */
export var OpenState;
(function (OpenState) {
    OpenState[OpenState["CLOSED"] = 0] = "CLOSED";
    OpenState[OpenState["OPENED"] = 1] = "OPENED";
    OpenState[OpenState["FLAGGED"] = 2] = "FLAGGED";
})(OpenState || (OpenState = {}));
export function assertBoardInfo(boardInfo) {
    const info = boardInfo;
    assert(typeof boardInfo === 'object' &&
        !!boardInfo &&
        typeof info.height === 'number' &&
        typeof info.width === 'number' &&
        Array.isArray(info.cellData), 'Invalid Board Info: ' + JSON.stringify(boardInfo));
}
class DimensionCoder {
    static valueCoder = new BitExtendedCoder(4);
    static timeElapsedCoder = new BitExtendedCoder(7);
    encodeValue(value, encoder) {
        const { height, width, elapsedTime } = value;
        if (height === 16 && width === 30) {
            // 0b11 -> Expert
            encoder.encodeBit(0.5, 1);
            encoder.encodeBit(0.5, 1);
        }
        else if (height === 16 && width === 16) {
            // 0b01 -> Intermediate
            encoder.encodeBit(0.5, 1);
            encoder.encodeBit(0.5, 0);
        }
        else if (height === 9 && width === 9) {
            // 0b10 -> Beginner
            encoder.encodeBit(0.5, 0);
            encoder.encodeBit(0.5, 1);
        }
        else {
            // 0b00 -> Custom
            encoder.encodeBit(0.5, 0);
            encoder.encodeBit(0.5, 0);
            // write out height using 4-bit, bit-extended format
            DimensionCoder.valueCoder.encodeValue(height - 1, encoder);
            // write out width using 4-bit, bit-extended format, with delta encoding
            // from the height
            DimensionCoder.valueCoder.encodeValue(DeltaCoder.encode(width, height, 1), encoder);
        }
        if (elapsedTime) {
            encoder.encodeBit(0.5, 1);
            DimensionCoder.timeElapsedCoder.encodeValue(Math.trunc(elapsedTime / 500), encoder);
        }
        else {
            encoder.encodeBit(0.5, 0);
        }
    }
    decodeValue(decoder) {
        const b1 = decoder.decodeBit(0.5);
        const b2 = decoder.decodeBit(0.5);
        let height;
        let width;
        if (b1 === 1 && b2 === 1) {
            // 0b11 -> Expert
            height = 16;
            width = 30;
        }
        else if (b1 == 1 && b2 === 0) {
            // 0b01 -> Intermediate
            height = 16;
            width = 16;
        }
        else if (b1 === 0 && b2 === 1) {
            // 0b10 -> Beginner
            height = 9;
            width = 9;
        }
        else {
            // 0b00 -> Custom
            height = DimensionCoder.valueCoder.decodeValue(decoder) + 1;
            width = DeltaCoder.decode(DimensionCoder.valueCoder.decodeValue(decoder), height, 1);
        }
        let elapsedTime = 0;
        if (decoder.decodeBit(0.5)) {
            elapsedTime = DimensionCoder.timeElapsedCoder.decodeValue(decoder) * 500;
        }
        return { width, height, elapsedTime };
    }
}
class MineCountCoder {
    width;
    height;
    standardBoardSize;
    expectedMineCount;
    customCoder;
    constructor(width, height) {
        this.width = width;
        this.height = height;
        if (this.width === 30 && this.height === 16) {
            this.standardBoardSize = true;
            this.expectedMineCount = 99;
        }
        else if (this.width === 16 && this.height === 16) {
            this.standardBoardSize = true;
            this.expectedMineCount = 40;
        }
        else if (this.width === 9 && this.height === 9) {
            this.standardBoardSize = true;
            this.expectedMineCount = 10;
        }
        else {
            this.standardBoardSize = false;
            // make the expected mine count 20% of cell count - pretty standard for
            // most custom games
            this.expectedMineCount = Math.round((this.width * this.height) / 5);
        }
        // custom board - use enough info-bits to encode within 5% of the 20%
        // mine count
        const baseBits = Math.max(32 - Math.clz32((this.width * this.height) / 20), 1);
        this.customCoder = new BitExtendedCoder(baseBits);
    }
    encodeValue(mineCount, encoder) {
        if (this.standardBoardSize) {
            if (this.expectedMineCount === mineCount) {
                // one of the standard boards - output a ONE bit
                encoder.encodeBit(0.5, 1);
                return;
            }
            else {
                // output a zero bit to indicate "standard board size with custom mine
                // count"
                encoder.encodeBit(0.5, 0);
            }
        }
        this.customCoder.encodeValue(DeltaCoder.encode(mineCount, this.expectedMineCount), encoder);
    }
    decodeValue(decoder) {
        if (this.standardBoardSize) {
            if (decoder.decodeBit(0.5)) {
                return this.expectedMineCount;
            }
        }
        return DeltaCoder.decode(this.customCoder.decodeValue(decoder), this.expectedMineCount);
    }
}
class MineMapCoder {
    cellCount;
    mineCountCoder;
    constructor(width, height) {
        this.cellCount = width * height;
        this.mineCountCoder = new MineCountCoder(width, height);
    }
    encodeValue(minemap, encoder) {
        let mineCount = 0;
        for (let i = 0; i < this.cellCount; i++) {
            if (minemap.getBit(i)) {
                mineCount++;
            }
        }
        this.mineCountCoder.encodeValue(mineCount, encoder);
        new CountCoder(this.cellCount, this.cellCount - mineCount).encode(minemap.toReader(), encoder);
    }
    decodeValue(decoder) {
        const mineCount = this.mineCountCoder.decodeValue(decoder);
        const mineMapCoder = new CountCoder(this.cellCount, this.cellCount - mineCount);
        const minemap = new BitSet();
        mineMapCoder.decode(decoder, minemap.toWriter());
        return minemap;
    }
}
class MineTallyCoder {
    width;
    height;
    mineField;
    cellCount;
    openCountCoder;
    openMineCountCoder;
    flagCountCoder;
    wrongFlagCountCoder;
    closedInOpenGroupCoder;
    constructor(width, height, mineField) {
        this.width = width;
        this.height = height;
        this.mineField = mineField;
        this.cellCount = width * height;
        // Use a fixed-size number coder for the open count
        this.openCountCoder = new NumberCoder(this.cellCount + 1);
        this.flagCountCoder = new BitExtendedCoder(Math.max(32 - Math.clz32(this.mineField.mineCount) - 1, 1));
        this.openMineCountCoder =
            this.wrongFlagCountCoder =
                this.closedInOpenGroupCoder =
                    new BitExtendedCoder(0);
    }
    encodeValue(tally, encoder) {
        this.openCountCoder.encodeValue(tally.opened, encoder);
        this.openMineCountCoder.encodeValue(tally.openMines + 1, encoder);
        this.flagCountCoder.encodeValue(tally.flags, encoder);
        this.wrongFlagCountCoder.encodeValue(tally.wrongFlags + 1, encoder);
        this.closedInOpenGroupCoder.encodeValue(tally.closedInOpenGroup + 1, encoder);
    }
    decodeValue(decoder) {
        const opened = this.openCountCoder.decodeValue(decoder);
        const openMines = this.openMineCountCoder.decodeValue(decoder) - 1;
        const flags = this.flagCountCoder.decodeValue(decoder);
        const wrongFlags = this.wrongFlagCountCoder.decodeValue(decoder) - 1;
        const closedInOpenGroup = this.closedInOpenGroupCoder.decodeValue(decoder) - 1;
        return {
            cells: this.cellCount,
            mines: this.mineField.mineCount,
            opened,
            openMines,
            flags,
            wrongFlags,
            closedInOpenGroup,
        };
    }
}
class OpenStateCoder {
    width;
    height;
    mineField;
    tallyCoder;
    constructor(width, height, mineField) {
        this.width = width;
        this.height = height;
        this.mineField = mineField;
        this.tallyCoder = new MineTallyCoder(width, height, mineField);
    }
    encodeValue(cells, encoder) {
        trace('[OpenStateCoder.encodeValue] encoding: %o', cells);
        const tally = generateTally(this.width, this.height, this.mineField, cells);
        if (tally.opened === 0 && tally.flags === 0) {
            trace('[OpenStateCoder.encodeValue] encoding closed board');
            // untouched board. Encode with a single '0'
            encoder.encodeBit(0.5, 0);
            return;
        }
        else {
            trace('[OpenStateCoder.encodeValue] encoding tally: %o', tally);
            // board with data - emit single '1' before the tally data
            encoder.encodeBit(0.5, 1);
            this.tallyCoder.encodeValue(tally, encoder);
        }
        // flagRatio indicates the flagging style of game-play... a value near or
        // greater than 1 indicates 'full-flag', a value near zero indicates
        // 'no-flag', while a value in the middle indicates 'efficiency'.
        const flagRatio = tally.mines === 0
            ? 1.0
            : tally.cells === tally.mines
                ? 0.0
                : tally.flags /
                    tally.mines /
                    (tally.opened / (tally.cells - tally.mines));
        // Use a board to track groups of opened cells. This helps compress opened
        // areas
        const board = new MineBoard(this.mineField);
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++, i++) {
                const left = this.left(cells, this.mineField, x, y);
                const up = this.up(cells, this.mineField, x, y);
                const isMine = this.mineField.getCellValue(x, y) === CellVisibleState.MINE;
                const isInOpenGroup = board.getCell(x, y).isOpened();
                const { pOpen, pFlag } = pOpenState([left, up].filter((n) => !!n), isMine, isInOpenGroup, tally, flagRatio);
                const cellState = cells[i] ?? OpenState.CLOSED;
                trace('[OpenStateCoder.encodeValue] encoding cell: %o', () => ({
                    cellState,
                    left,
                    up,
                    x,
                    y,
                    isMine,
                    isInOpenGroup,
                    flagRatio,
                    pOpen,
                    pFlag,
                }));
                encodeOpenState(cellState, pOpen, pFlag, encoder);
                if (cellState === OpenState.OPENED) {
                    board.getCell(x, y).openNoExpand();
                }
                updateTally(tally, isMine, cells[i], isInOpenGroup, -1);
            }
        }
    }
    decodeValue(decoder) {
        const hasViewData = decoder.decodeBit(0.5);
        const cells = [];
        if (!hasViewData) {
            // no more data encoded - all cells are closed
            for (let i = this.width * this.height; i > 0; i--) {
                cells.push(OpenState.CLOSED);
            }
            return cells;
        }
        const tally = this.tallyCoder.decodeValue(decoder);
        const flagRatio = tally.mines === 0
            ? 1.0
            : tally.cells === tally.mines
                ? 0.0
                : tally.flags /
                    tally.mines /
                    (tally.opened / (tally.cells - tally.mines));
        // Use a board to track groups of opened cells. This helps compress opened
        // areas
        const board = new MineBoard(this.mineField);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const left = this.left(cells, this.mineField, x, y);
                const up = this.up(cells, this.mineField, x, y);
                const isMine = this.mineField.getCellValue(x, y) === CellVisibleState.MINE;
                const isInOpenGroup = board.getCell(x, y).isOpened();
                const { pOpen, pFlag } = pOpenState([left, up].filter((n) => !!n), isMine, isInOpenGroup, tally, flagRatio);
                const cellState = decodeOpenState(pOpen, pFlag, decoder);
                cells.push(cellState);
                if (cellState === OpenState.OPENED) {
                    board.getCell(x, y).openNoExpand();
                }
                updateTally(tally, isMine, cellState, isInOpenGroup, -1);
            }
        }
        return cells;
    }
    neighbor(cells, mineField, x, y, dx, dy) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
            return undefined;
        }
        return {
            isMine: mineField.getCellValue(nx, ny) === CellVisibleState.MINE,
            openState: cells[ny * this.width + nx],
        };
    }
    left(cells, mineField, x, y) {
        return this.neighbor(cells, mineField, x, y, -1, 0);
    }
    up(cells, mineField, x, y) {
        return this.neighbor(cells, mineField, x, y, 0, -1);
    }
}
export class MineBoardCoder {
    static dimensionCoder = new DimensionCoder();
    encodeValue(board, encoder) {
        const { width, height } = board;
        const { minemap, openState } = splitKnownCells(board.cellData);
        const mineField = MineField.createMineFieldWithMineMap(width, height, [...minemap].map(b => !!b));
        MineBoardCoder.dimensionCoder.encodeValue(board, encoder);
        new MineMapCoder(width, height).encodeValue(minemap, encoder);
        new OpenStateCoder(width, height, mineField).encodeValue(openState, encoder);
    }
    decodeValue(decoder) {
        const { width, height, elapsedTime } = MineBoardCoder.dimensionCoder.decodeValue(decoder);
        const minemap = new MineMapCoder(width, height).decodeValue(decoder);
        const mineField = MineField.createMineFieldWithMineMap(width, height, [...minemap].map(b => !!b));
        const openState = new OpenStateCoder(width, height, mineField).decodeValue(decoder);
        return {
            width,
            height,
            elapsedTime,
            cellData: joinKnownCells(minemap, openState),
        };
    }
}
function splitKnownCells(cells) {
    const writer = new BitSetWriter();
    const openState = [];
    for (const cell of cells) {
        writer.write(cell.isMine ? 1 : 0);
        openState.push(cell.openState ?? OpenState.CLOSED);
    }
    return { minemap: writer.bitset, openState };
}
function joinKnownCells(minemap, openState) {
    const cells = [];
    for (let i = 0; i < openState.length; i++) {
        cells.push({ isMine: !!minemap.getBit(i), openState: openState[i] });
    }
    return cells;
}
function encodeOpenState(state, pOpen, pFlag, encoder) {
    const isClosed = state === OpenState.CLOSED;
    // closed:   0b0
    // open:    0b01
    // flagged: 0b11
    encoder.encodeBit(Math.max(1.0 - pOpen - pFlag, 0.0), isClosed ? 0 : 1);
    if (!isClosed) {
        encoder.encodeBit(pOpen / (pOpen + pFlag), state === OpenState.FLAGGED ? 1 : 0);
    }
}
function decodeOpenState(pOpen, pFlag, decoder) {
    const isClosed = !decoder.decodeBit(Math.max(1.0 - pOpen - pFlag, 0.0));
    if (isClosed) {
        return OpenState.CLOSED;
    }
    return decoder.decodeBit(pOpen / (pOpen + pFlag))
        ? OpenState.FLAGGED
        : OpenState.OPENED;
}
/** Go through the board and generate a tally of the various values */
function generateTally(width, height, mineField, openState) {
    const tally = {
        flags: 0,
        opened: 0,
        wrongFlags: 0,
        openMines: 0,
        mines: 0,
        cells: 0,
        closedInOpenGroup: 0,
    };
    const board = new MineBoard(mineField);
    let i = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++, i++) {
            const isMine = mineField.getCellValue(x, y) === CellVisibleState.MINE;
            const isOpenGroup = board.getCell(i).isOpened();
            if (openState[i] === OpenState.OPENED) {
                board.getCell(i).openNoExpand();
            }
            updateTally(tally, isMine, openState[i], isOpenGroup, 1);
        }
    }
    return tally;
}
function updateTally(tally, isMine, openState, isOpenGroup, count) {
    const isFlag = openState === OpenState.FLAGGED;
    const isOpen = openState === OpenState.OPENED;
    tally.cells += count;
    if (isFlag) {
        tally.flags += count;
        if (isOpenGroup)
            tally.closedInOpenGroup += count;
    }
    else if (isOpen) {
        tally.opened += count;
    }
    else if (isOpenGroup) {
        tally.closedInOpenGroup += count;
    }
    if (isMine) {
        tally.mines += count;
        if (isOpen)
            tally.openMines += count;
    }
    else {
        if (isFlag)
            tally.wrongFlags += count;
    }
}
function pOpenState(neighbors, isMine, isInOpenGroup, tally, flagRatio) {
    trace('[pOpenState] %o', {
        neighbors,
        isMine,
        isInOpenGroup,
        tally,
        flagRatio,
    });
    const openCellsRemaining = tally.opened - tally.openMines;
    const nonMineCellsRemaining = tally.cells - tally.mines;
    // The raw probabilities that the current cell is open or flagged. This
    // does not yet consider the neighbor's status, or the board state
    let pOpen = isMine
        ? tally.openMines / tally.mines
        : openCellsRemaining / nonMineCellsRemaining;
    let pFlag = isMine
        ? (tally.flags - tally.wrongFlags) / tally.mines
        : tally.wrongFlags / nonMineCellsRemaining;
    if (pOpen === 1 || pFlag === 1 || (pOpen === 0 && pFlag === 0)) {
        // got a guaranteed cell
        return { pOpen, pFlag };
    }
    else if (isInOpenGroup) {
        // part of an "open group", so probably open.
        return {
            pOpen: (nonMineCellsRemaining - tally.closedInOpenGroup) /
                nonMineCellsRemaining,
            pFlag: 
            // closedInOpenGroup count both flags and closed - so divide by two
            // for an approximate probability
            Math.min(tally.wrongFlags, tally.closedInOpenGroup / 2) /
                nonMineCellsRemaining,
        };
    }
    else {
        let neighborCount = neighbors.length;
        let neighborsOpen = 0;
        let closedMineNeighborCount = 0;
        for (const n of neighbors) {
            if (n?.openState)
                neighborsOpen++;
            if (n.isMine && !n?.openState)
                closedMineNeighborCount++;
        }
        // update neighborCount using flagRatio - if it is a no-flag game,
        // treat a neighboring un-flagged mine as no neighbor at all
        neighborCount -= closedMineNeighborCount * Math.max(1 - flagRatio, 0);
        // This number ranges from 0 to 1, and indicates the status of the
        // neighbors' open state. A 0.5 indicates no information (no
        // neighbors, or ex. two neighbors that don't agree). A 1 indicates all
        // neighbors are open. A 0 indicates all neighbors are closed.
        const neighborOpenWeight = neighborCount === 0 ? 0.5 : neighborsOpen / neighborCount;
        // we use Math.pow to "lift" or "suppress" a probability. For example,
        // if there are multiple neighbors, all of which are open, the current
        // cell is much more likely to be open. So we use
        // pOpen = 1 - (1 - pOpen)^a, where a >= 1. The higher 'a', the more
        // pOpen is lifted. Similarly, to suppress (for no open neighbors), we use
        // pOpen = pOpen^a, where again, a higher 'a' means more suppression.
        // We have scaled neighborOpenWeight to be a value between -3 and 3,
        // which will be our 'a' in the calculations below.
        trace('[pOpenState] weighting neighbor %o', {
            neighborOpenWeight,
            pFlag,
            pOpen,
        });
        if (neighborOpenWeight <= 0.5) {
            // fewer open neighbors - suppress the probability of open or flag
            if (isMine) {
                pFlag = Math.pow(pFlag, (0.5 - neighborOpenWeight) * 4 + 1);
            }
            else {
                pOpen = Math.pow(pOpen, (0.5 - neighborOpenWeight) * 4 + 1);
            }
        }
        else {
            if (isMine) {
                pFlag = 1 - Math.pow(1 - pFlag, (neighborOpenWeight - 0.5) * 4 + 1);
                // make sure there's enough space to encode a possible open mine
                pOpen = Math.min(pOpen, (1 - pFlag) / 2);
            }
            else {
                pOpen = 1 - Math.pow(1 - pOpen, (neighborOpenWeight - 0.5) * 4 + 1);
                // make sure there's enough space to encode a possible wrong flag
                pFlag = Math.min(pFlag, (1 - pOpen) / 2);
            }
        }
        return { pOpen, pFlag };
    }
}
/**
 * The compression below uses Huffman Codes to compress a mine bitmap. Consider
 * a board like:
 *
 * OOXOXO
 * XOOOXO
 * OOOOXO
 *
 * Here, 'O' represents an open cell, while 'X' represents a mine. This can
 * be represented as a bitmap using the value: 0b001010100010000010n
 *
 * Since the probability of an open cell ranges from about 0.7 up to about
 * 0.85, there is room for compression here. Optimal compression is given by:
 * log2(combination(w*h, m))/(w*h)
 *
 * Where w = width, h = height, m = mine-count, combination is the combination
 * function: combination(n, m) = n!/(m!*(n-m)!), and log2 is the log base-2.
 * For an "Expert" board where w = 30, h = 16, and m = 99, this gives an
 * optimal compression of 72.5%.
 *
 * Here, we are using a modified Huffman prefix code, with a lsd bit packing.
 * The code used here is optimized specifically for the Expert setup, and gives
 * an average compression rate of 74.0%, which is very close to optimal.
 *
 * For Intermediate boards (w = 16, h = 16, m = 40), optimal compression is
 * 61.0%, and this huffman encoding gives 64.3%. Similarly for Beginner
 * boards (w = 9, h = 9, m = 10) we have 50.3% and 57.9% respectively.
 */
export const minefieldHuffmanCode = constructHuffmanCode([
    [
        { value: 0b000, bitCount: 3 },
        { value: 0b0, bitCount: 1 },
    ],
    [
        { value: 0b100, bitCount: 3 },
        { value: 0b001, bitCount: 3 },
    ],
    [
        { value: 0b010, bitCount: 3 },
        { value: 0b101, bitCount: 3 },
    ],
    [
        { value: 0b110, bitCount: 3 },
        { value: 0b00111, bitCount: 5 },
    ],
    [
        { value: 0b001, bitCount: 3 },
        { value: 0b011, bitCount: 3 },
    ],
    [
        { value: 0b101, bitCount: 3 },
        { value: 0b10111, bitCount: 5 },
    ],
    [
        { value: 0b011, bitCount: 3 },
        { value: 0b01111, bitCount: 5 },
    ],
    [
        { value: 0b111, bitCount: 3 },
        { value: 0b11111, bitCount: 5 },
    ],
]);
/**
 * Describe a boards play style. This affects the compression algorithm.
 * FULL_FLAG assumes that all (most) mines will be flagged. NO_FLAG assumes that
 * no (very few) mines will be flagged. And EFFICIENCY assumes that a mine is as
 * likely to be flagged as not.
 */
export var FlagMode;
(function (FlagMode) {
    FlagMode[FlagMode["FULL_FLAG"] = 0] = "FULL_FLAG";
    FlagMode[FlagMode["NO_FLAG"] = 1] = "NO_FLAG";
    FlagMode[FlagMode["EFFICIENCY"] = 2] = "EFFICIENCY";
})(FlagMode || (FlagMode = {}));
/**
 * An arithmetic model that gives a probability that the next cell is open based
 * on the status of its previous neighbors. This expected that the cells are
 * processed in grid order (one line or row at a time, no zig/zag ordering)
 */
// export class OpenBoardModel implements ArithmeticModel {
//   private previousRow: boolean[] = [];
//   private currentRow: boolean[] = [];
//   private y = 0;
//   constructor(
//     private readonly width: number,
//     private readonly flagMode = FlagMode.FULL_FLAG,
//     private readonly minemap?: boolean[]
//   ) {
//     assert(
//       flagMode === FlagMode.FULL_FLAG || minemap !== null,
//       'NO_FLAG and EFFICIENCY modes require a minemap'
//     );
//   }
//   probabilityOfZero(): number {
//     const upOpen = this.getUpOpen();
//     const leftOpen = this.getLeftOpen();
//     const isMine = this.minemap?.[this.y * this.width + this.currentRow.length];
//     if (this.flagMode === FlagMode.NO_FLAG && isMine) {
//       // in NO_FLAG, all mines, regardless of neighbors, are left closed at a
//       // rate of P_BOTH_MATCH
//       return P_BOTH_MATCH;
//     }
//     if (upOpen === leftOpen && upOpen !== undefined) {
//       // both match. For mines in EFFICIENCY mode, use 50/50 if neighbors are
//       // open, otherwise use the standard low probability of being open
//       return upOpen
//         ? isMine && this.flagMode === FlagMode.EFFICIENCY
//           ? 0.5
//           : 1 - P_BOTH_MATCH
//         : P_BOTH_MATCH;
//     }
//     if (
//       (upOpen === undefined || leftOpen === undefined) &&
//       upOpen !== leftOpen
//     ) {
//       // One match. For mines in EFFICIENCY mode, use 50/50 if neighbor is
//       // open, otherwise use the standard low probability of being open
//       return upOpen ?? leftOpen
//         ? isMine && this.flagMode === FlagMode.EFFICIENCY
//           ? 0.5
//           : 1 - P_ONLY_MATCH
//         : P_ONLY_MATCH;
//     }
//     // for cells with no knowledge, or cells with conflicting neighbors, use
//     // 50%
//     return 0.5;
//   }
//   private getLeftOpen(): boolean | undefined {
//     if (!this.currentRow.length) {
//       return undefined;
//     }
//     const x = this.currentRow.length - 1;
//     const leftOpen = this.currentRow[x];
//     if (leftOpen || this.flagMode === FlagMode.FULL_FLAG) {
//       return leftOpen;
//     }
//     return this.minemap?.[this.y * this.width + x] ? undefined : false;
//   }
//   private getUpOpen(): boolean | undefined {
//     if (!this.y) {
//       return undefined;
//     }
//     const x = this.currentRow.length;
//     const upOpen = this.previousRow[x];
//     if (upOpen || this.flagMode === FlagMode.FULL_FLAG) {
//       return upOpen;
//     }
//     return this.minemap?.[(this.y - 1) * this.width + x] ? undefined : false;
//   }
//   applySample(b: Bit) {
//     this.currentRow.push(!!b);
//     if (this.currentRow.length === this.width) {
//       this.previousRow = this.currentRow;
//       this.currentRow = [];
//       this.y++;
//     }
//   }
// }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZXN3ZWVwZXJfc3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taW5lc3dlZXBlci9taW5lc3dlZXBlcl9zdG9yYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3JELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNoRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUMxRSxPQUFPLEVBSUwsZ0JBQWdCLEVBQ2hCLFVBQVUsRUFDVixXQUFXLEdBQ1osTUFBTSxtQ0FBbUMsQ0FBQztBQUMzQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFvQjNDLHFEQUFxRDtBQUNyRCxNQUFNLENBQU4sSUFBWSxTQUlYO0FBSkQsV0FBWSxTQUFTO0lBQ25CLDZDQUFVLENBQUE7SUFDViw2Q0FBVSxDQUFBO0lBQ1YsK0NBQVcsQ0FBQTtBQUNiLENBQUMsRUFKVyxTQUFTLEtBQVQsU0FBUyxRQUlwQjtBQUVELE1BQU0sVUFBVSxlQUFlLENBQzdCLFNBQW1CO0lBRW5CLE1BQU0sSUFBSSxHQUFHLFNBQW9DLENBQUM7SUFDbEQsTUFBTSxDQUNKLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFDM0IsQ0FBQyxDQUFDLFNBQVM7UUFDWCxPQUFPLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUTtRQUMvQixPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUTtRQUM5QixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFDOUIsc0JBQXNCLEdBQUcsSUFBSSxD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