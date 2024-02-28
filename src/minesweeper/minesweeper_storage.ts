import {Bit, BitSetWriter, toBitReader, toBitWriter} from '../util/io.js';
import {DeltaCoder} from '../util/storage.js';
import {assert} from '../util/assert.js';
import {CellVisibleState, MineBoard, MineField} from './minesweeper.js';
import {
  ArithmeticDecoder,
  ArithmeticEncoder,
  ArithmeticValueCoder,
  BitExtendedCoder,
  CountCoder,
  NumberCoder,
  decodeValue,
  encodeValueToBitSet,
} from '../util/compression/arithmetic.js';
import {trace} from '../util/logging.js';
import {decodeBase64, encodeBase64} from '../util/base64.js';

/**
 * The state of a "known" board (i.e. a board where all the mine locations are
 * known in addition to what is exposed to the player). This provides enough
 * information to continue playing a game from a saved point.
 */
export interface KnownBoardState {
  width: number;
  height: number;

  /** The cell data. The length of this will always be width * height */
  cellData: KnownCell[];

  /** The elapsed time, if known. */
  elapsedTime?: number;
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

/**
 * The compressed/encoded state of a "known" board. The information here should
 * be 1-to-1 translatable to the information in KnownBoardInfo
 */
export interface EncodedBoardState {
  /**
   * An identifier that encodes the following:
   * * width/height
   * * mine count
   * * mine placement
   */
  boardId: string;

  /**
   * An identifier that encodes the following:
   * * open cells
   * * flagged cells
   * * closed cells
   */
  viewState?: string;

  /**
   * An encoded version of the elapsed time.
   */
  elapsedTime?: string;
}

export function encodeBoardId(boardInfo: KnownBoardState): string {
  return encodeBase64(
    encodeValueToBitSet(boardInfo, MINE_BOARD_CODER).toReader(),
  );
}

export function encodeViewState(
  boardInfo: KnownBoardState,
): string | undefined {
  let hasData = false;
  const openState: OpenState[] = [];
  for (const cell of boardInfo.cellData) {
    const state = cell.openState ?? OpenState.CLOSED;
    hasData ||= state !== OpenState.CLOSED;
    openState.push(state);
  }
  if (!hasData) {
    return undefined;
  }
  const minefield = MineField.createMineFieldWithMineMap(
    boardInfo.width,
    boardInfo.height,
    boardInfo.cellData.map(c => c.isMine),
  );
  const coder = new OpenStateCoder(
    boardInfo.width,
    boardInfo.height,
    minefield,
  );
  return encodeBase64(encodeValueToBitSet(openState, coder).toReader());
}

export function encodeElapsedTime(elapsedTime?: number): string | undefined {
  if (!elapsedTime) return undefined;
  return encodeBase64(
    // use BigInt since time values may go beyond 32 bits... although, that
    // would be a very long game.
    new BitSetWriter().writeBigBits(BigInt(elapsedTime)).bitset.toReader(),
  );
}

export function encodeBoardState(
  boardState: KnownBoardState,
): EncodedBoardState {
  const boardId = encodeBoardId(boardState);
  const viewState = encodeViewState(boardState);
  const elapsedTime = encodeElapsedTime(boardState.elapsedTime);
  return elapsedTime ? {boardId, viewState, elapsedTime} : {boardId, viewState};
}

/**
 * This will return a new KnownBoardInfo. All cellData[x].openState will be
 * unset.
 */
export function decodeBoardId(boardId: string): KnownBoardState {
  return decodeValue(decodeBase64(boardId).bitset.toReader(), MINE_BOARD_CODER);
}

/**
 * Decode the view state. This updates the boardInfo.cellData[x].openState
 * values. The view state must have been generated from a similar boardInfo
 * that had the same width,height, and mine placement. If this was not the case
 * then the results are undefined. (Current implementation will end up filling
 * the state with garbage)
 */
export function decodeViewState(
  boardInfo: KnownBoardState,
  viewState?: string,
) {
  if (!viewState) {
    return;
  }
  const minefield = MineField.createMineFieldWithMineMap(
    boardInfo.width,
    boardInfo.height,
    boardInfo.cellData.map(c => c.isMine),
  );
  const coder = new OpenStateCoder(
    boardInfo.width,
    boardInfo.height,
    minefield,
  );
  const openState: OpenState[] = decodeValue(
    decodeBase64(viewState).bitset.toReader(),
    coder,
  );
  for (let i = 0; i < openState.length; i++) {
    boardInfo.cellData[i].openState = openState[i];
  }
}

export function decodeElapsedTime(elapsedTime?: string): number | undefined {
  if (!elapsedTime) return undefined;
  return Number(decodeBase64(elapsedTime).bitset.toBigInt());
}

export function decodeBoardState(
  boardState: EncodedBoardState,
): KnownBoardState {
  const boardInfo = decodeBoardId(boardState.boardId);
  decodeViewState(boardInfo, boardState.viewState);
  const elapsedTime = decodeElapsedTime(boardState.elapsedTime);
  if (elapsedTime) {
    boardInfo.elapsedTime = elapsedTime;
  }
  return boardInfo;
}

export function assertBoardState(
  boardState?: unknown,
): asserts boardState is KnownBoardState {
  const state = boardState as Partial<KnownBoardState>;
  assert(
    typeof boardState === 'object' &&
      !!boardState &&
      typeof state.height === 'number' &&
      typeof state.width === 'number' &&
      Array.isArray(state.cellData) &&
      state.cellData.length === state.height * state.width,
    'Invalid Board State: ' + JSON.stringify(boardState),
  );
}

export function assertEncodedBoardState(
  encodedBoardState?: unknown,
): asserts encodedBoardState is EncodedBoardState {
  const state = encodedBoardState as Partial<EncodedBoardState>;
  assert(
    typeof state === 'object' &&
      !!state &&
      typeof state.boardId === 'string' &&
      (!state.viewState || typeof state.viewState === 'string') &&
      (!state.elapsedTime || typeof state.elapsedTime === 'string'),
    'Invalid Encoded Board State: ' + JSON.stringify(encodedBoardState),
  );
}

class DimensionCoder implements ArithmeticValueCoder<Dimension> {
  private static readonly valueCoder = new BitExtendedCoder(4);

  encodeValue(value: Dimension, encoder: ArithmeticEncoder): void {
    const {height, width} = value;
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

    return {width, height};
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

class MineMapCoder implements ArithmeticValueCoder<Bit[]> {
  private readonly cellCount: number;
  private readonly mineCountCoder: MineCountCoder;

  constructor(width: number, height: number) {
    this.cellCount = width * height;
    this.mineCountCoder = new MineCountCoder(width, height);
  }
  encodeValue(minemap: Bit[], encoder: ArithmeticEncoder): void {
    const mineCount = minemap.reduce<number>((t, v) => t + v, 0);
    this.mineCountCoder.encodeValue(mineCount, encoder);
    new CountCoder(this.cellCount, this.cellCount - mineCount).encode(
      toBitReader(minemap),
      encoder,
    );
  }

  decodeValue(decoder: ArithmeticDecoder): Bit[] {
    const mineCount = this.mineCountCoder.decodeValue(decoder);
    const mineMapCoder = new CountCoder(
      this.cellCount,
      this.cellCount - mineCount,
    );
    const minemap: Bit[] = [];
    mineMapCoder.decode(decoder, toBitWriter(minemap));
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

        const {pOpen, pFlag} = pOpenState(
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

        const {pOpen, pFlag} = pOpenState(
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

class MineBoardCoder implements ArithmeticValueCoder<KnownBoardState> {
  private static readonly dimensionCoder = new DimensionCoder();

  encodeValue(board: KnownBoardState, encoder: ArithmeticEncoder): void {
    const {width, height} = board;
    const mineMap: Bit[] = board.cellData.map(c => (c.isMine ? 1 : 0));
    MineBoardCoder.dimensionCoder.encodeValue(board, encoder);
    new MineMapCoder(width, height).encodeValue(mineMap, encoder);
  }

  decodeValue(decoder: ArithmeticDecoder): KnownBoardState {
    const {width, height} = MineBoardCoder.dimensionCoder.decodeValue(decoder);
    const minemap = new MineMapCoder(width, height).decodeValue(decoder);
    const cellData: KnownCell[] = minemap.map(m => ({isMine: !!m}));

    return {
      width,
      height,
      cellData,
    };
  }
}

const MINE_BOARD_CODER = new MineBoardCoder();

interface Dimension {
  width: number;
  height: number;
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
): {pOpen: number; pFlag: number} {
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
    return {pOpen, pFlag};
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
    return {pOpen, pFlag};
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
