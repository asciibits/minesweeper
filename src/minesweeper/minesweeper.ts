import {
  bitmapFromLexicalOrdering,
  lexicalOrdering,
} from '../util/combinitorics.js';
import { Random, choose } from '../util/random.js';
import { assert } from '../util/assert.js';
import { IterType, asIterable } from '../util/utils.js';

/** The value displayed in a cell. */
export enum CellVisibleState {
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  UNKNOWN = -1,
  MINE = -2,
  FLAG = -3,
}

/** The position of a cell in a mine field */
export interface Position {
  x: number;
  y: number;
}

/** Given the position within a board, return the positions index */
function positionIndex(
  p: Position | number,
  width: number,
  height: number
): number {
  if (typeof p === 'number') {
    return p;
  }
  assert(
    p.x >= 0 && p.x < width && p.y >= 0 && p.y < height,
    'position outside grid'
  );
  return p.y * width + p.x;
}

/** Potential opening move restrictions */
export enum OpeningRestrictions {
  NO_MINE, // Opening position can't be a mine
  ZERO, // Opening position must be a zero
  ANY, // Anything, even a mine, can be at the opening position
}

/** A generic view of a MineField */
export interface MineFieldView {
  readonly width: number;
  readonly height: number;
  readonly mineCount: number;

  /** Return the visible value if this cell were open */
  getCellValue(x: number, y: number): CellVisibleState;

  getValueMap(): CellVisibleState[];
}

export function mineFieldsEqual(f1: MineFieldView, f2: MineFieldView): boolean {
  const cellMap1 = f1.getValueMap();
  const cellMap2 = f2.getValueMap();

  return (
    cellMap1.length === cellMap2.length &&
    cellMap1.every((c, i) => c === cellMap2[i])
  );
}

/** A MineView that delays its construction until the first cell is opened */
export class DelayedMineField implements MineFieldView {
  private delegate: MineFieldView | undefined = undefined;
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly mineCount: number,
    private readonly openingRestriction = OpeningRestrictions.ZERO,
    private readonly rand?: Random
  ) {
    assert(width > 0 && height > 0, 'Width and height must be positive');
    assert(mineCount >= 0, 'Mine count must be positive');
    let extraSpaceNeeded: number;
    switch (openingRestriction) {
      case OpeningRestrictions.ANY:
        extraSpaceNeeded = 0;
        break;
      case OpeningRestrictions.NO_MINE:
        extraSpaceNeeded = 1;
        break;
      case OpeningRestrictions.ZERO:
        extraSpaceNeeded = 9;
        break;
    }
    const maxMines = Math.max(width * height - extraSpaceNeeded, 0);
    assert(mineCount <= maxMines, 'Not enough space for the mines');
  }

  getCellValue(x: number, y: number): CellVisibleState {
    if (!this.delegate) {
      this.delegate = MineField.createRandomMineFieldWithOpening(
        this.width,
        this.height,
        this.mineCount,
        { x, y },
        this.openingRestriction,
        this.rand
      );
    }
    return this.delegate.getCellValue(x, y);
  }

  getValueMap(): CellVisibleState[] {
    return this.delegate?.getValueMap() ?? [];
  }
}

/**
 * The contents of a Minesweeper field. Essentially, a simple MineFieldView,
 * with some initialization capabilities
 */
export class MineField implements MineFieldView {
  public readonly mineCount: number;
  private readonly board: CellVisibleState[] = [];
  private _boardNumber?: bigint;

  constructor(
    public readonly width: number,
    public readonly height: number,
    mines: Array<number | Position>
  ) {
    assert(width > 0 && height > 0, 'Width and height must be positive values');
    assert(mines.length <= width * height, 'Mine count must be <= cell count');
    this.mineCount = mines.length;
    this.initBoard(mines);
  }

  static createRandomMineField(
    width: number,
    height: number,
    mineCount: number,
    reservedPositions?: Array<number | Position>,
    rand?: Random
  ): MineField {
    const cellCount = width * height;

    const reservedSet = new Set<number>();
    for (const p of reservedPositions?.map(rp =>
      positionIndex(rp, width, height)
    ) ?? []) {
      assert(!reservedSet.has(p), `reserved cell already added`);
      reservedSet.add(p);
    }

    // Make sure there's enough space for the mines
    assert(
      mineCount <= cellCount - reservedSet.size,
      `Not enough room for the requested number of mines`
    );

    // To determine the random mine positions, first create an array of all
    // positions(i.e. [0, 1, 2, ..., n]). Next, filter out any reserved
    // positions. And last, for the first 'b' positions, swap it with a random
    // position after it. Those first 'b' positions become the mines.
    const mines = choose(
      Array.from({ length: cellCount }, (_v, i) => i).filter(
        p => !reservedSet.has(p)
      ),
      mineCount,
      rand
    );

    return new MineField(width, height, mines);
  }

  static createRandomMineFieldWithOpening(
    width: number,
    height: number,
    mineCount: number,
    openingPosition?: Position,
    openingRestriction = OpeningRestrictions.ANY,
    rand?: Random
  ): MineField {
    const { x, y } = openingPosition ?? { x: 0, y: 0 };
    const reservedPositions: Position[] = [];
    switch (openingRestriction) {
      case OpeningRestrictions.NO_MINE:
        // just add the single cell to the "skip" set
        reservedPositions.push({ x, y });
        break;
      case OpeningRestrictions.ZERO:
        // add the opening cell and all adjacent cells to the "skip" set
        for (let ix = Math.max(x - 1, 0); ix < Math.min(x + 2, width); ix++) {
          for (
            let iy = Math.max(y - 1, 0);
            iy < Math.min(y + 2, height);
            iy++
          ) {
            reservedPositions.push({ x: ix, y: iy });
          }
        }
        break;
      case OpeningRestrictions.ANY:
      // no restrictions
    }
    return this.createRandomMineField(
      width,
      height,
      mineCount,
      reservedPositions,
      rand
    );
  }

  static createMineFieldWithBoardNumber(
    width: number,
    height: number,
    mines: number,
    boardNumber: bigint
  ) {
    const size = width * height;

    const mineCells: number[] = [];
    let minemap = bitmapFromLexicalOrdering(boardNumber, size, mines);
    for (let i = size - 1; i >= 0; i--, minemap >>= 1n) {
      if (minemap & 1n) {
        mineCells.push(i);
      }
    }

    return new MineField(width, height, mineCells);
  }

  static createMineFieldWithMineMap(
    width: number,
    height: number,
    mineMap: boolean[]
  ) {
    const mineCells: number[] = [];
    for (let i = 0; i < mineMap.length; i++) {
      if (mineMap[i]) {
        mineCells.push(i);
      }
    }
    return new MineField(width, height, mineCells);
  }

  /**
   * Given the location of the mines, build the board array. The mine positions
   * may be given as either a user-friendly x/y coordinate, or as an index
   * defined as: y * width + x
   */
  private initBoard(mines: Array<number | Position>) {
    const w = this.width;
    const h = this.height;

    // initalize the board with zeros
    this.board.length = w * h;
    this.board.fill(CellVisibleState.ZERO);

    /**
     * For the given position p, increment the mine-count for all cells around
     * it, and decrement the mine position by 10
     */
    const setMine = (p: number | Position) => {
      const y = typeof p === 'number' ? Math.trunc(p / w) : p.y;
      const x = typeof p === 'number' ? p - y * w : p.x;
      assert(
        y >= 0 && y < h && x >= 0 && x < w,
        'Mine position is outside the grid'
      );
      if (this.board[x + y * w] < 0) {
        throw new Error(
          `Same cell marked as mine more than once: {X: ${x}, y: ${y}}`
        );
      }
      // Set the cell to a mine
      this.board[x + y * w] = CellVisibleState.MINE;
      for (let ix = Math.max(x - 1, 0); ix < Math.min(x + 2, w); ix++) {
        for (let iy = Math.max(y - 1, 0); iy < Math.min(y + 2, h); iy++) {
          if (this.board[ix + iy * w] !== CellVisibleState.MINE) {
            this.board[ix + iy * w]++;
          }
        }
      }
    };
    for (const mine of mines) {
      setMine(mine);
    }
  }

  /**
   * Get the unique ID for this mine configuration. If you were to assign each
   * cell a 1 for a mine, and a 0 for no mine, then create a string by
   * concatenating all such rows starting at the top, this method yields the
   * lexical ordering for all strings of the same length with the same number
   * of mines.
   */
  getBoardNumber(): bigint {
    if (this._boardNumber === undefined) {
      let minemap = 0n;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          minemap <<= 1n;
          if (this.board[x + y * this.width] < 0) {
            minemap |= 1n;
          }
        }
      }
      this._boardNumber = lexicalOrdering(minemap, this.width * this.height);
    }
    return this._boardNumber;
  }

  /**
   * Returns the number of adjacent mines, or a negative number if the cell
   * itself is a mine.
   */
  getCellValue(x: number, y: number): CellVisibleState {
    return this.board[x + y * this.width];
  }

  getValueMap(): CellVisibleState[] {
    // should maybe make a defensive copy
    return this.board;
  }

  clearTransientState(): this {
    this._boardNumber = undefined;
    return this;
  }

  toString(): string {
    const board = this.board;
    if (!board) {
      return 'Uninitialized';
    }
    return Array.from({ length: this.height })
      .map((_v, y) =>
        Array.from({ length: this.width })
          .map((_v, x) => board[x + y * this.width])
          .map(v => (v === CellVisibleState.MINE ? 'X' : String(v)))
          .join('')
      )
      .join('\n');
  }
}

export enum BoardEventType {
  DISPOSE,
  RESET,
  READY,
  FIRST_MOVE,
  EXPLODE,
  UNEXPLODE,
  COMPLETE,
  UNCOMPLETE,
  MINE_COUNT_CHANGED,
  /** CELLS_OPENED is only fired once when a group is opened */
  CELLS_OPENED,
  TIME_ELAPSED,
}
export interface BoardEvent {
  type: BoardEventType;
  attributes?: Record<string, unknown>;
}
export type BoardListener = (board: MineBoard, event: BoardEvent) => void;

export class MineBoard {
  private readonly cells: Cell[] = [];
  private readonly listeners: BoardListener[] = [];
  private readonly cellListener: CellListener;
  private openMines = 0;
  private minesRemaining = 0;
  private cellsRemaining = 0;
  private boardStarted = 0;
  private boardEnded = 0;
  private started = false;
  private view: MineFieldView;
  private clockEventInterval = 0;
  private timerId: unknown | undefined;

  constructor(view: MineFieldView) {
    this.cellListener = this.getCellListener();
    this.reset(view);
    // already done in reset, but makes the compiler happy
    this.view = view;
  }

  getCellVisibleState(x: number, y: number): CellVisibleState {
    const cell = this.cells[x + y * this.view.width];
    return cell?.getVisibleState() ?? CellVisibleState.UNKNOWN;
  }

  private getCellListener(): CellListener {
    return (c, e) => {
      switch (e.type) {
        case CellEventType.OPEN:
          if (c.isMine()) {
            const newExplode = this.openMines === 0;
            this.openMines++;
            if (newExplode) {
              this.stopClock();
              this.fireEvent(BoardEventType.EXPLODE, e.attributes);
            }
          } else {
            this.cellsRemaining--;
            if (!this.started) {
              this.started = true;
              this.startClock();
              this.fireEvent(BoardEventType.FIRST_MOVE, e.attributes);
            }
            if (!this.cellsRemaining) {
              this.stopClock();
              this.fireEvent(BoardEventType.COMPLETE, e.attributes);
            }
          }
          break;
        case CellEventType.FLAG:
          if (c.isFlagged()) {
            this.minesRemaining--;
          } else {
            this.minesRemaining++;
          }
          this.fireEvent(BoardEventType.MINE_COUNT_CHANGED, e.attributes);
          break;
        case CellEventType.CLOSE:
          if (c.isMine()) {
            this.openMines--;
            if (!this.openMines) {
              this.startClock();
              this.fireEvent(BoardEventType.UNEXPLODE, e.attributes);
            }
          } else {
            if (!this.cellsRemaining++) {
              this.startClock();
              this.fireEvent(BoardEventType.UNCOMPLETE, e.attributes);
            }
          }
          break;
      }
    };
  }

  expandZeroGroup(cells: IterType<Cell>): Set<Cell> {
    const group = new Set<Cell>();
    const toProcess = new Set<Cell>();
    function pop(): Cell {
      for (const cell of toProcess) {
        toProcess.delete(cell);
        return cell;
      }
      throw new Error('Empty');
    }
    for (const cell of asIterable(cells)) {
      toProcess.add(cell);
    }
    while (toProcess.size) {
      const cell = pop();
      const { x, y } = cell.position;
      group.add(cell);
      const value = this.view.getCellValue(x, y);
      if (value === CellVisibleState.ZERO) {
        for (const n of cell.getNeighbors()) {
          if (!group.has(n)) {
            toProcess.add(n);
          }
        }
      }
    }
    return group;
  }

  getCell(pos: Position): Cell;
  getCell(index: number): Cell;
  getCell(x: number, y: number): Cell;
  getCell(xOrPosition: number | Position, y?: number): Cell {
    if (typeof xOrPosition === 'number') {
      if (y === undefined) {
        assert(
          xOrPosition >= 0 && xOrPosition < this.cells.length,
          'Index out of bounds'
        );
        return this.cells[xOrPosition];
      } else {
        assert(
          xOrPosition >= 0 &&
            xOrPosition < this.view.width &&
            y >= 0 &&
            y < this.view.height,
          'position outside grid'
        );
        return this.cells[xOrPosition + y * this.view.width];
      }
    } else {
      return this.cells[
        positionIndex(xOrPosition, this.view.width, this.view.height)
      ];
    }
  }

  getAllCells(): Cell[] {
    return this.cells;
  }

  getVisibleStateMap(): CellVisibleState[] {
    return this.cells.map(c => c.getVisibleState());
  }

  isExploded() {
    return this.openMines > 0;
  }

  isComplete() {
    return this.started && this.cellsRemaining <= 0;
  }

  getMinesRemaining() {
    return this.minesRemaining;
  }

  getCellsRemaining() {
    return this.cellsRemaining;
  }

  getTimeElapsed() {
    if (this.boardStarted === 0) {
      return 0;
    } else if (this.boardEnded === 0) {
      return Date.now() - this.boardStarted;
    } else {
      return this.boardEnded - this.boardStarted;
    }
  }

  setTimeElapsed(timeElapsed: number, attributes?: Record<string, unknown>) {
    this.boardStarted = (this.boardEnded || Date.now()) - timeElapsed;
    this.startClock(attributes);
  }

  setClockEventInterval(
    clockEventInterval: number,
    attributes?: Record<string, unknown>
  ) {
    this.clockEventInterval = clockEventInterval;
    if (clockEventInterval > 0) {
      this.startClock(attributes);
    } else {
      this.stopClock(attributes);
    }
  }

  private startClock(attributes?: Record<string, unknown>) {
    if (
      this.timerId === undefined &&
      this.started &&
      this.boardEnded === 0 &&
      this.clockEventInterval > 0
    ) {
      this.boardStarted = Date.now();
      this.fireEvent(BoardEventType.TIME_ELAPSED, attributes);
      this.timerId = setInterval(() => {
        this.fireEvent(BoardEventType.TIME_ELAPSED, attributes);
      }, this.clockEventInterval);
    }
  }

  private stopClock(attributes?: Record<string, unknown>) {
    if (this.boardStarted !== 0 && this.boardEnded === 0) {
      this.boardEnded = Date.now();
      this.fireEvent(BoardEventType.TIME_ELAPSED, attributes);
    }
    if (this.timerId !== undefined) {
      clearInterval(this.timerId as string);
      this.timerId = undefined;
    }
  }

  reset(view: MineFieldView, attributes?: Record<string, unknown>) {
    this.view = view;
    // rebuild the cell array
    for (const cell of this.getAllCells()) {
      cell.dispose(attributes);
    }

    const { width: w, height: h } = view;
    this.cells.length = w * h;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const cell = (this.cells[x + y * w] = new Cell({ x, y }, this));
        cell.addListener(this.cellListener);
      }
    }
    this.initializeStats();
    this.fireEvent(BoardEventType.RESET, attributes);
  }

  getView(): MineFieldView {
    return this.view;
  }

  private initializeStats() {
    this.openMines = 0;
    const { width: w, height: h, mineCount: m } = this.getView();
    this.minesRemaining = m;
    this.cellsRemaining = w * h - m;
    this.boardStarted = 0;
    this.boardEnded = 0;
    this.stopClock();
    this.started = false;
  }

  dispose(attributes?: Record<string, unknown>) {
    for (const cell of this.cells) {
      cell.dispose();
    }
    this.fireEvent(BoardEventType.DISPOSE, attributes);
    this.listeners.length = 0;
    this.cells.length = 0;
  }

  openGroup(group: IterType<Cell>, attributes?: Record<string, unknown>) {
    for (const cell of asIterable(group)) {
      if (!cell.isOpened()) {
        cell.openNoExpand();
      }
    }
    this.fireEvent(BoardEventType.CELLS_OPENED, attributes);
  }

  addListener(listener: BoardListener) {
    this.listeners.push(listener);
  }

  fireEvent(type: BoardEventType, attributes?: Record<string, unknown>) {
    for (const listener of this.listeners) {
      listener(this, { type, attributes });
    }
  }
}

export enum CellEventType {
  OPEN,
  CLOSE,
  FLAG,
  WRONG,
  RESET,
  DISPOSE,
  PRESS,
}
export interface CellEvent {
  type: CellEventType;
  attributes?: Record<string, unknown>;
}

export type CellListener = (cell: Cell, event: CellEvent) => void;

export class Cell {
  private flagged = false;
  private value?: CellVisibleState;
  private opened = false;
  private pressed = false;
  private wrong = false;
  private readonly listeners: CellListener[] = [];
  private attributes = new Map<string, unknown>();
  private neighbors: Cell[] = [];

  constructor(
    public readonly position: Readonly<Position>,
    private readonly board: MineBoard
  ) {}

  getVisibleState(): CellVisibleState {
    return this.opened
      ? this.peek()
      : this.flagged
        ? CellVisibleState.FLAG
        : CellVisibleState.UNKNOWN;
  }
  isFlagged(): boolean {
    return this.flagged;
  }
  isMine() {
    return this.peek() === CellVisibleState.MINE;
  }
  isOpened(): boolean {
    return this.opened;
  }
  isPressed() {
    return this.pressed;
  }
  isWrong() {
    return this.wrong;
  }
  /** Like open, but doesn't expand a zero-group */
  openNoExpand(attributes?: Record<string, unknown>): number {
    if (!this.opened) {
      this.flag(false);
      this.opened = true;
      this.fireEvent(CellEventType.OPEN, attributes);
    }
    return this.peek();
  }
  /**
   * Kind of like openNoExpand, but expands a zero-group.
   */
  open(attributes?: Record<string, unknown>) {
    this.board.openGroup(this.board.expandZeroGroup([this]), attributes);
  }
  peek(): number {
    if (this.value === undefined) {
      this.value = this.board
        .getView()
        .getCellValue(this.position.x, this.position.y);
    }
    return this.value;
  }
  // close an open cell. Used mostly for implementing undo and similar
  close(attributes?: Record<string, unknown>): void {
    if (this.opened) {
      // Note: Firing the event *before* changing the value. This allows
      // listeners to read the value while handling the event
      this.fireEvent(CellEventType.CLOSE, attributes);
      this.opened = false;
    }
  }
  chord(attributes?: Record<string, unknown>) {
    if (!this.isOpened() || this.isMine()) {
      // nothing to do for closed or mines
      return;
    }
    // find adjacent mine count
    let adjacentFlags = 0;
    const adjacentClosed: Cell[] = [];
    this.getNeighbors().forEach(n => {
      if (n.isFlagged()) {
        adjacentFlags++;
      } else if (!n.isOpened()) {
        adjacentClosed.push(n);
      }
    });
    if (adjacentFlags === this.peek()) {
      this.board.openGroup(
        this.board.expandZeroGroup(adjacentClosed),
        attributes
      );
    }
  }
  flag(flagged = true, attributes?: Record<string, unknown>) {
    if (!this.isOpened() && flagged !== this.flagged) {
      this.flagged = flagged;
      this.fireEvent(CellEventType.FLAG, attributes);
    }
  }
  setWrong(wrong = true, attributes?: Record<string, unknown>) {
    if (this.wrong !== wrong) {
      this.wrong = wrong;
      this.fireEvent(CellEventType.WRONG, attributes);
    }
  }
  press(pressed = true, attributes?: Record<string, unknown>) {
    if (this.isOpened() || this.isFlagged()) {
      // nothing to do for open or flags
      return;
    }
    if (this.pressed !== pressed) {
      this.pressed = pressed;
      this.fireEvent(CellEventType.PRESS, attributes);
    }
  }
  pressChord(pressed = true, attributes?: Record<string, unknown>) {
    if (!this.isOpened() || this.isMine()) {
      // nothing to do for closed or mines
      return;
    }
    this.getNeighbors().forEach(n => n.press(pressed, attributes));
  }
  pressCellOrChord(pressed = true, attributes?: Record<string, unknown>) {
    if (!this.isOpened()) {
      this.press(pressed, attributes);
    } else {
      this.pressChord(pressed, attributes);
    }
  }
  getNeighbors(): Cell[] {
    if (!this.neighbors.length) {
      const { x, y } = this.position;
      const { width: w, height: h } = this.board.getView();
      for (let ix = Math.max(x - 1, 0); ix < Math.min(x + 2, w); ix++) {
        for (let iy = Math.max(y - 1, 0); iy < Math.min(y + 2, h); iy++) {
          if (ix !== x || iy !== y) {
            this.neighbors.push(this.board.getCell(ix, iy));
          }
        }
      }
    }
    return this.neighbors;
  }
  addListener(listener: CellListener) {
    this.listeners.push(listener);
  }
  reset(attributes?: Record<string, unknown>) {
    this.flagged = false;
    this.opened = false;
    this.pressed = false;
    this.wrong = false;
    this.value = undefined;
    this.fireEvent(CellEventType.RESET, attributes);
  }
  dispose(attributes?: Record<string, unknown>) {
    this.fireEvent(CellEventType.DISPOSE, attributes);
    this.listeners.length = 0;
    this.attributes.clear();
  }
  setAttribute(name: string, value: unknown) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): unknown {
    return this.attributes.get(name);
  }

  clearAttribute(name: string) {
    this.attributes.delete(name);
  }

  private fireEvent(type: CellEventType, attributes?: Record<string, unknown>) {
    for (const listener of this.listeners) {
      listener(this, { type, attributes });
    }
  }
}

export enum InferredValue {
  SAFE = 1,
  MINE,
}

export interface InferredCellInfo {
  /** How many adjacent cells are known to be a mine */
  adjacentMines: number;
  /** How many adjacent cells are known to be safe (i.e. not a mine) */
  adjacentSafe: number;

  /** The status if it has been inferred, undefined otherwise */
  inferred?: InferredValue;

  /**
   * If not present, this cell has not yet had its mine/safe status applied to
   * its neighbors
   */
  counted?: true;
}

export class SimpleAnalyzer {
  // all cells that we've identified as mines. Note: these may or may not be
  // flagged by the user
  private mineCells = new Set<Cell>();

  // All numbered cells that still have unopened and non-inferred cells around
  private unresolvedOpenCells = new Set<Cell>();

  // A shared work queue
  private workQueue = new Set<Cell>();

  constructor(private readonly board: MineBoard) {
    board.addListener((b, e) => {
      switch (e.type) {
        case BoardEventType.RESET:
          this.initCells();
          break;
      }
    });
    this.initCells();
  }

  /** New board - create and initialize the inferred data structures */
  private initCells() {
    this.mineCells.clear();
    this.unresolvedOpenCells.clear();
    this.workQueue.clear();

    for (const cell of this.board.getAllCells()) {
      if (cell.isOpened()) {
        if (cell.isMine()) {
          getInferredData(cell).inferred = InferredValue.MINE;
          this.mineCells.add(cell);
        } else {
          getInferredData(cell).inferred = InferredValue.SAFE;
          this.unresolvedOpenCells.add(cell);
        }
        this.workQueue.add(cell);
      }
      cell.addListener((c, e) => {
        switch (e.type) {
          case CellEventType.OPEN:
            console.log('Opening cell');
            this.workQueue.add(c);
            this.processWorkQueue();
            console.log('Done Opening cell');
            break;
          case CellEventType.RESET:
            clearInferredData(c);
            break;
        }
      });
    }

    this.processWorkQueue();
  }

  getCellData(cell: Cell): InferredCellInfo {
    return getInferredData(cell);
  }

  /** Process all items in the work queue until it's empty */
  private processWorkQueue() {
    let i = 0;
    while (this.workQueue.size > 0) {
      i++;
      const cell = this.workQueue.values().next().value as Cell;
      this.workQueue.delete(cell);
      this.processWorkItem(cell);
    }
    console.log('Processed %d items', i);
  }

  /**
   * Process a single cell.
   *
   * If the cell is open or inferred but not counted, its status will be applied
   * to its neighbors, and they will all be added to the work queue.
   *
   * Similarly, if the cell is a mine or is an inferred-mine, then it has just
   * transitioned and its neighbors need to be updated.
   *
   * Otherwise, it is a closed cell with updated neighbor data that needs to be
   * checked for mine/safe status.
   */
  private processWorkItem(cell: Cell) {
    const inferredData = getInferredData(cell);

    // Apply an inferred or opened cell to its neighbors
    if (!inferredData.counted) {
      if (cell.isMine() || inferredData.inferred === InferredValue.MINE) {
        inferredData.inferred = InferredValue.MINE;
        // process mine's neighbors
        for (const neighbor of cell.getNeighbors()) {
          getInferredData(neighbor).adjacentMines++;
          this.workQueue.add(neighbor);
        }
        inferredData.counted = true;
      } else if (
        cell.isOpened() ||
        inferredData.inferred === InferredValue.SAFE
      ) {
        // have a new safe element to process
        for (const neighbor of cell.getNeighbors()) {
          getInferredData(neighbor).adjacentSafe++;
          this.workQueue.add(neighbor);
        }
        inferredData.counted = true;
      }
    }
    if (cell.isOpened()) {
      // for newly opened cells, update the inference
      inferredData.inferred = cell.isMine()
        ? InferredValue.MINE
        : InferredValue.SAFE;
    }

    const unresolvedNeighbors = cell
      .getNeighbors()
      .filter(n => !getInferredData(n).inferred);
    assert(
      cell.getVisibleState() < 0 ||
        cell.getVisibleState() <=
          unresolvedNeighbors.length + inferredData.adjacentMines,
      `not enough room for remaining mines: ${JSON.stringify(cell.position)}`
    );
    if (unresolvedNeighbors.length) {
      if (inferredData.adjacentMines === cell.getVisibleState()) {
        // got all mines. All remaining unresolved neighbors are safe
        for (const neighbor of unresolvedNeighbors) {
          getInferredData(neighbor).inferred = InferredValue.SAFE;
          this.workQueue.add(neighbor);
          // neighbor.open();
        }
      }
      if (
        cell.getVisibleState() ===
        unresolvedNeighbors.length + inferredData.adjacentMines
      ) {
        // remaining unresolved neighbors are all mines
        for (const neighbor of unresolvedNeighbors) {
          getInferredData(neighbor).inferred = InferredValue.MINE;
          this.workQueue.add(neighbor);
          neighbor.flag();
        }
      }
    }
  }
}

function getInferredData(cell: Cell): InferredCellInfo {
  let inferredData = cell.getAttribute('inferred') as InferredCellInfo;
  if (!inferredData) {
    inferredData = {
      adjacentMines: 0,
      adjacentSafe: 0,
    };
    cell.setAttribute('inferred', inferredData);
  }
  return inferredData;
}

function clearInferredData(cell: Cell) {
  cell.setAttribute('inferred', undefined);
}

// export interface Group {
//   numberedCells: Set<Cell>;
//   unknownCells: Set<Cell>;
// }

// export interface Cell

// export class BorderGroupDetector {
//   const groups: Group[] = [];
//   const cellToGroupMap = new Map<Cell, Group>();

//   // constructor(private readonly MineBoardView view) {
//   //   for (const cell of view.getAllCells()) {
//   //     const state = cell.getState();
//   //     if (state === CellState.MINE) {
//   //       // ??
//   //     }
//   //     // if (cell.getCellState())
//   //   }
//   // }

// }
