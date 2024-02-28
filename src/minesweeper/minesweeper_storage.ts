import { constructHuffmanCode } from '../util/compression/huffman.js';
import { BitSet, BitSetWriter } from '../util/io.js';
import { DeltaCoder } from '../util/storage.js';
import { assert } from '../util/assert.js';
import { CellVisibleState, MineBoard, MineField } from './minesweeper.js';
import {
  ArithmeticDecoder,
  ArithmeticEncoder,
  ArithmeticValueCoder,
  BitExtendedCoder,
  CountCoder,
  NumberCoder,
} from '../util/compression/arithmetic.js';
import { trace } from '../util/logging.js';

/**
 * The state of a "known" board (i.e. a board where all the mine locations are
 * known in addition to what is exposed to the player). This provides enough
 * information to continue playing a game from a saved point.
 */
export interface KnownBoardInfo {
  height: number;
  width: number;
  elapsedTime: number;
  cellData: KnownCell[];
}

/** The contents of a cell in a "known" game. */
export interface KnownCell {
  isMine: boolean;
  openState?: OpenState;
}

/** The "oppen" state of a cell in a "known" game. */
export enum OpenState {
  CLOSED = 0,
  OPENED = 1,
  FLAGGED = 2,
}

export function assertBoardInfo(
  boardInfo?: unknown,
): asserts boardInfo is KnownBoardInfo {
  const info = boardInfo as Partial<KnownBoardInfo>;
  assert(
    typeof boardInfo === 'object' &&
      !!boardInfo &&
      typeof info.height === 'number' &&
      typeof info.width === 'number' &&
      Array.isArray(info.cellData),
    'Invalid Board Info: ' + JSON.stringify(boardInfo),
  );
}

class DimensionCoder implements ArithmeticValueCoder<Dimension> {
  private static readonly valueCoder = new BitExtendedCoder(4);
  private static readonly timeElapsedCoder = new BitExtendedCoder(7);

  encodeValue(value: Dimension, encoder: ArithmeticEncoder): void {
    const { height, width, elapsedTime } = value;
    if (height === 16 && width === 30) {
      // 0b11 -> Expert
      encoder.encodeBit(0.5, 1);
      encoder.encodeBit(0.5, 1);
    } else if (height === 16 && width === 16) {
      // 0b01 -> Intermediate
      encoder.encodeBit(0.5, 1);
      encoder.encodeBit(0.5, 0);
    } else if (height === 9 && width === 9) {
      // 0b10 -> Beginner
      encoder.encodeBit(0.5, 0);
      encoder.encodeBit(0.5, 1);
    } else {
      // 0b00 -> Custom
      encoder.encodeBit(0.5, 0);
      encoder.encodeBit(0.5, 0);

      // write out height using 4-bit, bit-extended format
      DimensionCoder.valueCoder.encodeValue(height - 1, encoder);

      // write out width using 4-bit, bit-extended format, with delta encoding
      // from the height
      DimensionCoder.valueCoder.encodeValue(
        DeltaCoder.encode(width, height, 1),
        encoder,
      );
    }
    if (elapsedTime) {
      encoder.encodeBit(0.5, 1);
      DimensionCoder.timeElapsedCoder.encodeValue(
        Math.trunc(elapsedTime / 500),
        encoder,
      );
    } else {
      encoder.encodeBit(0.5, 0);
    }
  }
  decodeValue(decoder: ArithmeticDecoder): Dimension {
    const b1 = decoder.decodeBit(0.5);
    const b2 = decoder.decodeBit(0.5);

    let height: number;
    let width: number;
    if (b1 === 1 && b2 === 1) {
      // 0b11 -> Expert
      height = 16;
      width = 30;
    } else if (b1 == 1 && b2 === 0) {
      // 0b01 -> Intermediate
      height = 16;
      width = 16;
    } else if (b1 === 0 && b2 === 1) {
      // 0b10 -> Beginner
      height = 9;
      width = 9;
    } else {
      // 0b00 -> Custom
      height = DimensionCoder.valueCoder.decodeValue(decoder) + 1;
      width = DeltaCoder.decode(
        DimensionCoder.valueCoder.decodeValue(decoder),
        height,
        1,
      );
    }
    let elapsedTime = 0;
    if (decoder.decodeBit(0.5)) {
      elapsedTime = DimensionCoder.timeElapsedCoder.decodeValue(decoder) * 500;
    }

    return { width, height, elapsedTime };
  }
}

class MineCountCoder implements ArithmeticValueCoder<number> {
  private readonly standardBoardSize: boolean;
  private readonly expectedMineCount: number;
  private readonly customCoder: BitExtendedCoder;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    if (this.width === 30 && this.height === 16) {
      this.standardBoardSize = true;
      this.expectedMineCount = 99;
    } else if (this.width === 16 && this.height === 16) {
      this.standardBoardSize = true;
      this.expectedMineCount = 40;
    } else if (this.width === 9 && this.height === 9) {
      this.standardBoardSize = true;
      this.expectedMineCount = 10;
    } else {
      this.standardBoardSize = false;
      // make the expected mine count 20% of cell count - pretty standard for
      // most custom games
      this.expectedMineCount = Math.round((this.width * this.height) / 5);
    }
    // custom board - use enough info-bits to encode within 5% of the 20%
    // mine count
    const baseBits = Math.max(
      32 - Math.clz32((this.width * this.height) / 20),
      1,
    );
    this.customCoder = new BitExtendedCoder(baseBits);
  }

  encodeValue(mineCount: number, encoder: ArithmeticEncoder): void {
    if (this.standardBoardSize) {
      if (this.expectedMineCount === mineCount) {
        // one of the standard boards - output a ONE bit
        encoder.encodeBit(0.5, 1);
        return;
      } else {
        // output a zero bit to indicate "standard board size with custom mine
        // count"
        encoder.encodeBit(0.5, 0);
      }
    }

    this.customCoder.encodeValue(
      DeltaCoder.encode(mineCount, this.expectedMineCount),
      encoder,
    );
  }
  decodeValue(decoder: ArithmeticDecoder): number {
    if (this.standardBoardSize) {
      if (decoder.decodeBit(0.5)) {
        return this.expectedMineCount;
      }
    }
    return DeltaCoder.decode(
      this.customCoder.decodeValue(decoder),
      this.expectedMineCount,
    );
  }
}

class MineMapCoder implements ArithmeticValueCoder<BitSet> {
  private readonly cellCount: number;
  private readonly mineCountCoder: MineCountCoder;

  constructor(width: number, height: number) {
    this.cellCount = width * height;
    this.mineCountCoder = new MineCountCoder(width, height);
  }
  encodeValue(minemap: BitSet, encoder: ArithmeticEncoder): void {
    let mineCount = 0;
    for (let i = 0; i < this.cellCount; i++) {
      if (minemap.getBit(i)) {
        mineCount++;
      }
    }

    this.mineCountCoder.encodeValue(mineCount, encoder);
    new CountCoder(this.cellCount, this.cellCount - mineCount).encode(
      minemap.toReader(),
      encoder,
    );
  }

  decodeValue(decoder: ArithmeticDecoder): BitSet {
    const mineCount = this.mineCountCoder.decodeValue(decoder);
    const mineMapCoder = new CountCoder(
      this.cellCount,
      this.cellCount - mineCount,
    );
    const minemap = new BitSet();
    mineMapCoder.decode(decoder, minemap.toWriter());
    return minemap;
  }
}

class MineTallyCoder implements ArithmeticValueCoder<MineTally> {
  private readonly cellCount: number;

  private readonly openCountCoder: NumberCoder;
  private readonly openMineCountCoder: BitExtendedCoder;
  private readonly flagCountCoder: BitExtendedCoder;
  private readonly wrongFlagCountCoder: BitExtendedCoder;
  private readonly closedInOpenGroupCoder: BitExtendedCoder;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly mineField: MineField,
  ) {
    this.cellCount = width * height;

    // Use a fixed-size number coder for the open count
    this.openCountCoder = new NumberCoder(this.cellCount + 1);
    this.flagCountCoder = new BitExtendedCoder(
      Math.max(32 - Math.clz32(this.mineField.mineCount) - 1, 1),
    );
    this.openMineCountCoder =
      this.wrongFlagCountCoder =
      this.closedInOpenGroupCoder =
        new BitExtendedCoder(0);
  }

  encodeValue(tally: MineTally, encoder: ArithmeticEncoder): void {
    this.openCountCoder.encodeValue(tally.opened, encoder);
    this.openMineCountCoder.encodeValue(tally.openMines + 1, encoder);
    this.flagCountCoder.encodeValue(tally.flags, encoder);
    this.wrongFlagCountCoder.encodeValue(tally.wrongFlags + 1, encoder);
    this.closedInOpenGroupCoder.encodeValue(
      tally.closedInOpenGroup + 1,
      encoder,
    );
  }

  decodeValue(decoder: ArithmeticDecoder): MineTally {
    const opened = this.openCountCoder.decodeValue(decoder);
    const openMines = this.openMineCountCoder.decodeValue(decoder) - 1;
    const flags = this.flagCountCoder.decodeValue(decoder);
    const wrongFlags = this.wrongFlagCountCoder.decodeValue(decoder) - 1;
    const closedInOpenGroup =
      this.closedInOpenGroupCoder.decodeValue(decoder) - 1;

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

class OpenStateCoder implements ArithmeticValueCoder<OpenState[]> {
  private readonly tallyCoder: MineTallyCoder;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly mineField: MineField,
  ) {
    this.tallyCoder = new MineTallyCoder(width, height, mineField);
  }

  encodeValue(cells: OpenState[], encoder: ArithmeticEncoder) {
    trace('[OpenStateCoder.encodeValue] encoding: %o', cells);
    const tally = generateTally(this.width, this.height, this.mineField, cells);
    if (tally.opened === 0 && tally.flags === 0) {
      trace('[OpenStateCoder.encodeValue] encoding closed board');
      // untouched board. Encode with a single '0'
      encoder.encodeBit(0.5, 0);
      return;
    } else {
      trace('[OpenStateCoder.encodeValue] encoding tally: %o', tally);
      // board with data - emit single '1' before the tally data
      encoder.encodeBit(0.5, 1);
      this.tallyCoder.encodeValue(tally, encoder);
    }

    // flagRatio indicates the flagging style of game-play... a value near or
    // greater than 1 indicates 'full-flag', a value near zero indicates
    // 'no-flag', while a value in the middle indicates 'efficiency'.
    const flagRatio =
      tally.mines === 0
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
        const isMine =
          this.mineField.getCellValue(x, y) === CellVisibleState.MINE;
        const isInOpenGroup = board.getCell(x, y).isOpened();

        const { pOpen, pFlag } = pOpenState(
          [left, up].filter((n): n is KnownCell => !!n),
          isMine,
          isInOpenGroup,
          tally,
          flagRatio,
        );
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

  decodeValue(decoder: ArithmeticDecoder): OpenState[] {
    const hasViewData = decoder.decodeBit(0.5);
    const cells: OpenState[] = [];
    if (!hasViewData) {
      // no more data encoded - all cells are closed
      for (let i = this.width * this.height; i > 0; i--) {
        cells.push(OpenState.CLOSED);
      }
      return cells;
    }

    const tally = this.tallyCoder.decodeValue(decoder);
    const flagRatio =
      tally.mines === 0
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

        const isMine =
          this.mineField.getCellValue(x, y) === CellVisibleState.MINE;
        const isInOpenGroup = board.getCell(x, y).isOpened();

        const { pOpen, pFlag } = pOpenState(
          [left, up].filter((n): n is KnownCell => !!n),
          isMine,
          isInOpenGroup,
          tally,
          flagRatio,
        );
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

  private neighbor(
    cells: OpenState[],
    mineField: MineField,
    x: number,
    y: number,
    dx: number,
    dy: number,
  ): KnownCell | undefined {
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
  private left(cells: OpenState[], mineField: MineField, x: number, y: number) {
    return this.neighbor(cells, mineField, x, y, -1, 0);
  }
  private up(cells: OpenState[], mineField: MineField, x: number, y: number) {
    return this.neighbor(cells, mineField, x, y, 0, -1);
  }
}

export class MineBoardCoder implements ArithmeticValueCoder<KnownBoardInfo> {
  private static readonly dimensionCoder = new DimensionCoder();

  encodeValue(board: KnownBoardInfo, encoder: ArithmeticEncoder): void {
    const { width, height } = board;
    const { minemap, openState } = splitKnownCells(board.cellData);
    const mineField = MineField.createMineFieldWithMineMap(
      width,
      height,
      [...minemap].map(b => !!b),
    );
    MineBoardCoder.dimensionCoder.encodeValue(board, encoder);
    new MineMapCoder(width, height).encodeValue(minemap, encoder);
    new OpenStateCoder(width, height, mineField).encodeValue(
      openState,
      encoder,
    );
  }

  decodeValue(decoder: ArithmeticDecoder): KnownBoardInfo {
    const { width, height, elapsedTime } =
      MineBoardCoder.dimensionCoder.decodeValue(decoder);
    const minemap = new MineMapCoder(width, height).decodeValue(decoder);
    const mineField = MineField.createMineFieldWithMineMap(
      width,
      height,
      [...minemap].map(b => !!b),
    );
    const openState = new OpenStateCoder(width, height, mineField).decodeValue(
      decoder,
    );

    return {
      width,
      height,
      elapsedTime,
      cellData: joinKnownCells(minemap, openState),
    };
  }
}

function splitKnownCells(cells: KnownCell[]): {
  minemap: BitSet;
  openState: OpenState[];
} {
  const writer = new BitSetWriter();
  const openState: OpenState[] = [];
  for (const cell of cells) {
    writer.write(cell.isMine ? 1 : 0);
    openState.push(cell.openState ?? OpenState.CLOSED);
  }
  return { minemap: writer.bitset, openState };
}

function joinKnownCells(minemap: BitSet, openState: OpenState[]): KnownCell[] {
  const cells: KnownCell[] = [];

  for (let i = 0; i < openState.length; i++) {
    cells.push({ isMine: !!minemap.getBit(i), openState: openState[i] });
  }
  return cells;
}

interface Dimension {
  width: number;
  height: number;
  elapsedTime: number;
}

function encodeOpenState(
  state: OpenState,
  pOpen: number,
  pFlag: number,
  encoder: ArithmeticEncoder,
) {
  const isClosed = state === OpenState.CLOSED;
  // closed:   0b0
  // open:    0b01
  // flagged: 0b11
  encoder.encodeBit(Math.max(1.0 - pOpen - pFlag, 0.0), isClosed ? 0 : 1);
  if (!isClosed) {
    encoder.encodeBit(
      pOpen / (pOpen + pFlag),
      state === OpenState.FLAGGED ? 1 : 0,
    );
  }
}
function decodeOpenState(
  pOpen: number,
  pFlag: number,
  decoder: ArithmeticDecoder,
): OpenState {
  const isClosed = !decoder.decodeBit(Math.max(1.0 - pOpen - pFlag, 0.0));
  if (isClosed) {
    return OpenState.CLOSED;
  }
  return decoder.decodeBit(pOpen / (pOpen + pFlag))
    ? OpenState.FLAGGED
    : OpenState.OPENED;
}

interface MineTally {
  /** The number of flagged cells remaining */
  flags: number;

  /** The number of open cells remaining */
  opened: number;

  /**
   * The number of 'wrong flag' (i.e. a non-mine with a flag) remaining. This is
   * typically zero, or very small, except for crazy cases where someone just
   * spammed flags in a game.
   */
  wrongFlags: number;

  /**
   * The number of open mines remaining. This is zero for an in-progress game,
   * but could be one for a finished failed game. For display purposes, someone
   * might create a board with more, but it wouldn't be playable by standard
   * rules. (Maybe we invent a game that allows a certain number of wrong
   * guesses? 🤔)
   */
  openMines: number;

  /** The number or mines remaining */
  mines: number;

  /** The number of cells remaining */
  cells: number;

  /**
   * The number of cells that are closed or flagged, but part of a zero-group.
   * This would never happen in a real game, but could be set up for a
   * non-playable custom display. Or for a game that doesn't automatically open
   * up zero-groups.
   */
  closedInOpenGroup: number;
}

/** Go through the board and generate a tally of the various values */
function generateTally(
  width: number,
  height: number,
  mineField: MineField,
  openState: OpenState[],
): MineTally {
  const tally: MineTally = {
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

function updateTally(
  tally: MineTally,
  isMine: boolean,
  openState: OpenState,
  isOpenGroup: boolean,
  count: number,
) {
  const isFlag = openState === OpenState.FLAGGED;
  const isOpen = openState === OpenState.OPENED;

  tally.cells += count;
  if (isFlag) {
    tally.flags += count;
    if (isOpenGroup) tally.closedInOpenGroup += count;
  } else if (isOpen) {
    tally.opened += count;
  } else if (isOpenGroup) {
    tally.closedInOpenGroup += count;
  }
  if (isMine) {
    tally.mines += count;
    if (isOpen) tally.openMines += count;
  } else {
    if (isFlag) tally.wrongFlags += count;
  }
}

function pOpenState(
  neighbors: KnownCell[],
  isMine: boolean,
  isInOpenGroup: boolean,
  tally: MineTally,
  flagRatio: number,
): { pOpen: number; pFlag: number } {
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
  } else if (isInOpenGroup) {
    // part of an "open group", so probably open.
    return {
      pOpen:
        (nonMineCellsRemaining - tally.closedInOpenGroup) /
        nonMineCellsRemaining,
      pFlag:
        // closedInOpenGroup count both flags and closed - so divide by two
        // for an approximate probability
        Math.min(tally.wrongFlags, tally.closedInOpenGroup / 2) /
        nonMineCellsRemaining,
    };
  } else {
    let neighborCount = neighbors.length;
    let neighborsOpen = 0;
    let closedMineNeighborCount = 0;

    for (const n of neighbors) {
      if (n?.openState) neighborsOpen++;
      if (n.isMine && !n?.openState) closedMineNeighborCount++;
    }

    // update neighborCount using flagRatio - if it is a no-flag game,
    // treat a neighboring un-flagged mine as no neighbor at all
    neighborCount -= closedMineNeighborCount * Math.max(1 - flagRatio, 0);

    // This number ranges from 0 to 1, and indicates the status of the
    // neighbors' open state. A 0.5 indicates no information (no
    // neighbors, or ex. two neighbors that don't agree). A 1 indicates all
    // neighbors are open. A 0 indicates all neighbors are closed.
    const neighborOpenWeight =
      neighborCount === 0 ? 0.5 : neighborsOpen / neighborCount;

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
      } else {
        pOpen = Math.pow(pOpen, (0.5 - neighborOpenWeight) * 4 + 1);
      }
    } else {
      if (isMine) {
        pFlag = 1 - Math.pow(1 - pFlag, (neighborOpenWeight - 0.5) * 4 + 1);
        // make sure there's enough space to encode a possible open mine
        pOpen = Math.min(pOpen, (1 - pFlag) / 2);
      } else {
        pOpen = 1 - Math.pow(1 - pOpen, (neighborOpenWeight - 0.5) * 4 + 1);
        // make sure there's enough space to encode a possible wrong flag
        pFlag = Math.min(pFlag, (1 - pOpen) / 2);
      }
    }
    return { pOpen, pFlag };
  }
}

/**
 * The state of an "unknown" board (i.e. a board where the only information is
 * what's visible to the player). The locations of the mines are not known,
 * though with some analysis, some information may be inferred. This provides
 * enough information for some analysis, but in general does not provide a
 * playable game.
 */
export interface VisibleBoardInfo {
  height: number;
  width: number;
  cellState: CellVisibleState[];
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
export enum FlagMode {
  FULL_FLAG,
  NO_FLAG,
  EFFICIENCY,
}

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
