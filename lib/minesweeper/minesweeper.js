import { bitmapFromLexicalOrdering, lexicalOrdering, } from '../util/combinitorics.js';
import { choose } from '../util/random.js';
import { assert } from '../util/assert.js';
import { asIterable } from '../util/utils.js';
/** The value displayed in a cell. */
export var CellVisibleState;
(function (CellVisibleState) {
    CellVisibleState[CellVisibleState["ZERO"] = 0] = "ZERO";
    CellVisibleState[CellVisibleState["ONE"] = 1] = "ONE";
    CellVisibleState[CellVisibleState["TWO"] = 2] = "TWO";
    CellVisibleState[CellVisibleState["THREE"] = 3] = "THREE";
    CellVisibleState[CellVisibleState["FOUR"] = 4] = "FOUR";
    CellVisibleState[CellVisibleState["FIVE"] = 5] = "FIVE";
    CellVisibleState[CellVisibleState["SIX"] = 6] = "SIX";
    CellVisibleState[CellVisibleState["SEVEN"] = 7] = "SEVEN";
    CellVisibleState[CellVisibleState["EIGHT"] = 8] = "EIGHT";
    CellVisibleState[CellVisibleState["UNKNOWN"] = -1] = "UNKNOWN";
    CellVisibleState[CellVisibleState["MINE"] = -2] = "MINE";
    CellVisibleState[CellVisibleState["FLAG"] = -3] = "FLAG";
})(CellVisibleState || (CellVisibleState = {}));
/** Given the position within a board, return the positions index */
function positionIndex(p, width, height) {
    if (typeof p === 'number') {
        return p;
    }
    assert(p.x >= 0 && p.x < width && p.y >= 0 && p.y < height, 'position outside grid');
    return p.y * width + p.x;
}
/** Potential opening move restrictions */
export var OpeningRestrictions;
(function (OpeningRestrictions) {
    OpeningRestrictions[OpeningRestrictions["NO_MINE"] = 0] = "NO_MINE";
    OpeningRestrictions[OpeningRestrictions["ZERO"] = 1] = "ZERO";
    OpeningRestrictions[OpeningRestrictions["ANY"] = 2] = "ANY";
})(OpeningRestrictions || (OpeningRestrictions = {}));
export function mineFieldsEqual(f1, f2) {
    const cellMap1 = f1.getValueMap();
    const cellMap2 = f2.getValueMap();
    return (cellMap1.length === cellMap2.length &&
        cellMap1.every((c, i) => c === cellMap2[i]));
}
/** A MineView that delays its construction until the first cell is opened */
export class DelayedMineField {
    width;
    height;
    mineCount;
    openingRestriction;
    rand;
    delegate = undefined;
    constructor(width, height, mineCount, openingRestriction = OpeningRestrictions.ZERO, rand) {
        this.width = width;
        this.height = height;
        this.mineCount = mineCount;
        this.openingRestriction = openingRestriction;
        this.rand = rand;
        assert(width > 0 && height > 0, 'Width and height must be positive');
        assert(mineCount >= 0, 'Mine count must be positive');
        let extraSpaceNeeded;
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
    getCellValue(x, y) {
        if (!this.delegate) {
            this.delegate = MineField.createRandomMineFieldWithOpening(this.width, this.height, this.mineCount, { x, y }, this.openingRestriction, this.rand);
        }
        return this.delegate.getCellValue(x, y);
    }
    getValueMap() {
        return this.delegate?.getValueMap() ?? [];
    }
}
/**
 * The contents of a Minesweeper field. Essentially, a simple MineFieldView,
 * with some initialization capabilities
 */
export class MineField {
    width;
    height;
    mineCount;
    board = [];
    _boardNumber;
    constructor(width, height, mines) {
        this.width = width;
        this.height = height;
        assert(width > 0 && height > 0, 'Width and height must be positive values');
        assert(mines.length <= width * height, 'Mine count must be <= cell count');
        this.mineCount = mines.length;
        this.initBoard(mines);
    }
    static createRandomMineField(width, height, mineCount, reservedPositions, rand) {
        const cellCount = width * height;
        const reservedSet = new Set();
        for (const p of reservedPositions?.map(rp => positionIndex(rp, width, height)) ?? []) {
            assert(!reservedSet.has(p), `reserved cell already added`);
            reservedSet.add(p);
        }
        // Make sure there's enough space for the mines
        assert(mineCount <= cellCount - reservedSet.size, `Not enough room for the requested number of mines`);
        // To determine the random mine positions, first create an array of all
        // positions(i.e. [0, 1, 2, ..., n]). Next, filter out any reserved
        // positions. And last, for the first 'b' positions, swap it with a random
        // position after it. Those first 'b' positions become the mines.
        const mines = choose(Array.from({ length: cellCount }, (_v, i) => i).filter(p => !reservedSet.has(p)), mineCount, rand);
        return new MineField(width, height, mines);
    }
    static createRandomMineFieldWithOpening(width, height, mineCount, openingPosition, openingRestriction = OpeningRestrictions.ANY, rand) {
        const { x, y } = openingPosition ?? { x: 0, y: 0 };
        const reservedPositions = [];
        switch (openingRestriction) {
            case OpeningRestrictions.NO_MINE:
                // just add the single cell to the "skip" set
                reservedPositions.push({ x, y });
                break;
            case OpeningRestrictions.ZERO:
                // add the opening cell and all adjacent cells to the "skip" set
                for (let ix = Math.max(x - 1, 0); ix < Math.min(x + 2, width); ix++) {
                    for (let iy = Math.max(y - 1, 0); iy < Math.min(y + 2, height); iy++) {
                        reservedPositions.push({ x: ix, y: iy });
                    }
                }
                break;
            case OpeningRestrictions.ANY:
            // no restrictions
        }
        return this.createRandomMineField(width, height, mineCount, reservedPositions, rand);
    }
    static createMineFieldWithBoardNumber(width, height, mines, boardNumber) {
        const size = width * height;
        const mineCells = [];
        let minemap = bitmapFromLexicalOrdering(boardNumber, size, mines);
        for (let i = size - 1; i >= 0; i--, minemap >>= 1n) {
            if (minemap & 1n) {
                mineCells.push(i);
            }
        }
        return new MineField(width, height, mineCells);
    }
    static createMineFieldWithMineMap(width, height, mineMap) {
        const mineCells = [];
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
    initBoard(mines) {
        const w = this.width;
        const h = this.height;
        // initalize the board with zeros
        this.board.length = w * h;
        this.board.fill(CellVisibleState.ZERO);
        /**
         * For the given position p, increment the mine-count for all cells around
         * it, and decrement the mine position by 10
         */
        const setMine = (p) => {
            const y = typeof p === 'number' ? Math.trunc(p / w) : p.y;
            const x = typeof p === 'number' ? p - y * w : p.x;
            assert(y >= 0 && y < h && x >= 0 && x < w, 'Mine position is outside the grid');
            if (this.board[x + y * w] < 0) {
                throw new Error(`Same cell marked as mine more than once: {X: ${x}, y: ${y}}`);
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
    getBoardNumber() {
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
    getCellValue(x, y) {
        return this.board[x + y * this.width];
    }
    getValueMap() {
        // should maybe make a defensive copy
        return this.board;
    }
    clearTransientState() {
        this._boardNumber = undefined;
        return this;
    }
    toString() {
        const board = this.board;
        if (!board) {
            return 'Uninitialized';
        }
        return Array.from({ length: this.height })
            .map((_v, y) => Array.from({ length: this.width })
            .map((_v, x) => board[x + y * this.width])
            .map(v => (v === CellVisibleState.MINE ? 'X' : String(v)))
            .join(''))
            .join('\n');
    }
}
export var BoardEventType;
(function (BoardEventType) {
    BoardEventType[BoardEventType["DISPOSE"] = 0] = "DISPOSE";
    BoardEventType[BoardEventType["RESET"] = 1] = "RESET";
    BoardEventType[BoardEventType["READY"] = 2] = "READY";
    BoardEventType[BoardEventType["FIRST_MOVE"] = 3] = "FIRST_MOVE";
    BoardEventType[BoardEventType["EXPLODE"] = 4] = "EXPLODE";
    BoardEventType[BoardEventType["UNEXPLODE"] = 5] = "UNEXPLODE";
    BoardEventType[BoardEventType["COMPLETE"] = 6] = "COMPLETE";
    BoardEventType[BoardEventType["UNCOMPLETE"] = 7] = "UNCOMPLETE";
    BoardEventType[BoardEventType["MINE_COUNT_CHANGED"] = 8] = "MINE_COUNT_CHANGED";
    /** CELLS_OPENED is only fired once when a group is opened */
    BoardEventType[BoardEventType["CELLS_OPENED"] = 9] = "CELLS_OPENED";
    BoardEventType[BoardEventType["TIME_ELAPSED"] = 10] = "TIME_ELAPSED";
})(BoardEventType || (BoardEventType = {}));
export class MineBoard {
    cells = [];
    listeners = [];
    cellListener;
    openMines = 0;
    minesRemaining = 0;
    cellsRemaining = 0;
    boardStarted = 0;
    boardEnded = 0;
    started = false;
    view;
    clockEventInterval = 0;
    timerId;
    constructor(view) {
        this.cellListener = this.getCellListener();
        this.reset(view);
        // already done in reset, but makes the compiler happy
        this.view = view;
    }
    getCellVisibleState(x, y) {
        const cell = this.cells[x + y * this.view.width];
        return cell?.getVisibleState() ?? CellVisibleState.UNKNOWN;
    }
    getCellListener() {
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
                    }
                    else {
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
                    }
                    else {
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
                    }
                    else {
                        if (!this.cellsRemaining++) {
                            this.startClock();
                            this.fireEvent(BoardEventType.UNCOMPLETE, e.attributes);
                        }
                    }
                    break;
            }
        };
    }
    expandZeroGroup(cells) {
        const group = new Set();
        const toProcess = new Set();
        function pop() {
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
    getCell(xOrPosition, y) {
        if (typeof xOrPosition === 'number') {
            if (y === undefined) {
                assert(xOrPosition >= 0 && xOrPosition < this.cells.length, 'Index out of bounds');
                return this.cells[xOrPosition];
            }
            else {
                assert(xOrPosition >= 0 &&
                    xOrPosition < this.view.width &&
                    y >= 0 &&
                    y < this.view.height, 'position outside grid');
                return this.cells[xOrPosition + y * this.view.width];
            }
        }
        else {
            return this.cells[positionIndex(xOrPosition, this.view.width, this.view.height)];
        }
    }
    getAllCells() {
        return this.cells;
    }
    getVisibleStateMap() {
        return this.cells.map(c => c.getVisibleState());
    }
    isExploded() {
        return this.openMines > 0;
    }
    isComplete() {
        return this.started && this.cellsRemaining <= 0;
    }
    isStarted() {
        return this.started;
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
        }
        else if (this.boardEnded === 0) {
            return Date.now() - this.boardStarted;
        }
        else {
            return this.boardEnded - this.boardStarted;
        }
    }
    setTimeElapsed(timeElapsed, attributes) {
        this.boardStarted = (this.boardEnded || Date.now()) - timeElapsed;
        this.startClock(attributes);
    }
    setClockEventInterval(clockEventInterval, attributes) {
        this.clockEventInterval = clockEventInterval;
        if (clockEventInterval > 0) {
            this.startClock(attributes);
        }
        else {
            this.stopClock(attributes);
        }
    }
    startClock(attributes) {
        if (this.timerId === undefined &&
            this.started &&
            this.boardEnded === 0 &&
            this.clockEventInterval > 0) {
            this.boardStarted = Date.now();
            this.fireEvent(BoardEventType.TIME_ELAPSED, attributes);
            this.timerId = setInterval(() => {
                this.fireEvent(BoardEventType.TIME_ELAPSED, attributes);
            }, this.clockEventInterval);
        }
    }
    stopClock(attributes) {
        if (this.boardStarted !== 0 && this.boardEnded === 0) {
            this.boardEnded = Date.now();
            this.fireEvent(BoardEventType.TIME_ELAPSED, attributes);
        }
        if (this.timerId !== undefined) {
            clearInterval(this.timerId);
            this.timerId = undefined;
        }
    }
    reset(view, attributes) {
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
    getView() {
        return this.view;
    }
    initializeStats() {
        this.openMines = 0;
        const { width: w, height: h, mineCount: m } = this.getView();
        this.minesRemaining = m;
        this.cellsRemaining = w * h - m;
        this.boardStarted = 0;
        this.boardEnded = 0;
        this.stopClock();
        this.started = false;
    }
    dispose(attributes) {
        for (const cell of this.cells) {
            cell.dispose();
        }
        this.fireEvent(BoardEventType.DISPOSE, attributes);
        this.listeners.length = 0;
        this.cells.length = 0;
    }
    openGroup(group, attributes) {
        for (const cell of asIterable(group)) {
            if (!cell.isOpened()) {
                cell.openNoExpand();
            }
        }
        this.fireEvent(BoardEventType.CELLS_OPENED, attributes);
    }
    addListener(listener) {
        this.listeners.push(listener);
    }
    fireEvent(type, attributes) {
        for (const listener of this.listeners) {
            listener(this, { type, attributes });
        }
    }
}
export var CellEventType;
(function (CellEventType) {
    CellEventType[CellEventType["OPEN"] = 0] = "OPEN";
    CellEventType[CellEventType["CLOSE"] = 1] = "CLOSE";
    CellEventType[CellEventType["FLAG"] = 2] = "FLAG";
    CellEventType[CellEventType["WRONG"] = 3] = "WRONG";
    CellEventType[CellEventType["RESET"] = 4] = "RESET";
    CellEventType[CellEventType["DISPOSE"] = 5] = "DISPOSE";
    CellEventType[CellEventType["PRESS"] = 6] = "PRESS";
})(CellEventType || (CellEventType = {}));
export class Cell {
    position;
    board;
    flagged = false;
    value;
    opened = false;
    pressed = false;
    wrong = false;
    listeners = [];
    attributes = new Map();
    neighbors = [];
    constructor(position, board) {
        this.position = position;
        this.board = board;
    }
    getVisibleState() {
        return this.opened
            ? this.peek()
            : this.flagged
                ? CellVisibleState.FLAG
                : CellVisibleState.UNKNOWN;
    }
    isFlagged() {
        return this.flagged;
    }
    isMine() {
        return this.peek() === CellVisibleState.MINE;
    }
    isOpened() {
        return this.opened;
    }
    isPressed() {
        return this.pressed;
    }
    isWrong() {
        return this.wrong;
    }
    /** Like open, but doesn't expand a zero-group */
    openNoExpand(attributes) {
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
    open(attributes) {
        this.board.openGroup(this.board.expandZeroGroup([this]), attributes);
    }
    peek() {
        if (this.value === undefined) {
            this.value = this.board
                .getView()
                .getCellValue(this.position.x, this.position.y);
        }
        return this.value;
    }
    // close an open cell. Used mostly for implementing undo and similar
    close(attributes) {
        if (this.opened) {
            // Note: Firing the event *before* changing the value. This allows
            // listeners to read the value while handling the event
            this.fireEvent(CellEventType.CLOSE, attributes);
            this.opened = false;
        }
    }
    chord(attributes) {
        if (!this.isOpened() || this.isMine()) {
            // nothing to do for closed or mines
            return;
        }
        // find adjacent mine count
        let adjacentFlags = 0;
        const adjacentClosed = [];
        this.getNeighbors().forEach(n => {
            if (n.isFlagged()) {
                adjacentFlags++;
            }
            else if (!n.isOpened()) {
                adjacentClosed.push(n);
            }
        });
        if (adjacentFlags === this.peek()) {
            this.board.openGroup(this.board.expandZeroGroup(adjacentClosed), attributes);
        }
    }
    flag(flagged = true, attributes) {
        if (!this.isOpened() && flagged !== this.flagged) {
            this.flagged = flagged;
            this.fireEvent(CellEventType.FLAG, attributes);
        }
    }
    setWrong(wrong = true, attributes) {
        if (this.wrong !== wrong) {
            this.wrong = wrong;
            this.fireEvent(CellEventType.WRONG, attributes);
        }
    }
    press(pressed = true, attributes) {
        if (this.isOpened() || this.isFlagged()) {
            // nothing to do for open or flags
            return;
        }
        if (this.pressed !== pressed) {
            this.pressed = pressed;
            this.fireEvent(CellEventType.PRESS, attributes);
        }
    }
    pressChord(pressed = true, attributes) {
        if (!this.isOpened() || this.isMine()) {
            // nothing to do for closed or mines
            return;
        }
        this.getNeighbors().forEach(n => n.press(pressed, attributes));
    }
    pressCellOrChord(pressed = true, attributes) {
        if (!this.isOpened()) {
            this.press(pressed, attributes);
        }
        else {
            this.pressChord(pressed, attributes);
        }
    }
    getNeighbors() {
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
    addListener(listener) {
        this.listeners.push(listener);
    }
    reset(attributes) {
        this.flagged = false;
        this.opened = false;
        this.pressed = false;
        this.wrong = false;
        this.value = undefined;
        this.fireEvent(CellEventType.RESET, attributes);
    }
    dispose(attributes) {
        this.fireEvent(CellEventType.DISPOSE, attributes);
        this.listeners.length = 0;
        this.attributes.clear();
    }
    setAttribute(name, value) {
        this.attributes.set(name, value);
    }
    getAttribute(name) {
        return this.attributes.get(name);
    }
    clearAttribute(name) {
        this.attributes.delete(name);
    }
    fireEvent(type, attributes) {
        for (const listener of this.listeners) {
            listener(this, { type, attributes });
        }
    }
}
export var InferredValue;
(function (InferredValue) {
    InferredValue[InferredValue["SAFE"] = 1] = "SAFE";
    InferredValue[InferredValue["MINE"] = 2] = "MINE";
})(InferredValue || (InferredValue = {}));
export class SimpleAnalyzer {
    board;
    // all cells that we've identified as mines. Note: these may or may not be
    // flagged by the user
    mineCells = new Set();
    // All numbered cells that still have unopened and non-inferred cells around
    unresolvedOpenCells = new Set();
    // A shared work queue
    workQueue = new Set();
    constructor(board) {
        this.board = board;
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
    initCells() {
        this.mineCells.clear();
        this.unresolvedOpenCells.clear();
        this.workQueue.clear();
        for (const cell of this.board.getAllCells()) {
            if (cell.isOpened()) {
                if (cell.isMine()) {
                    getInferredData(cell).inferred = InferredValue.MINE;
                    this.mineCells.add(cell);
                }
                else {
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
    getCellData(cell) {
        return getInferredData(cell);
    }
    /** Process all items in the work queue until it's empty */
    processWorkQueue() {
        let i = 0;
        while (this.workQueue.size > 0) {
            i++;
            const cell = this.workQueue.values().next().value;
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
    processWorkItem(cell) {
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
            }
            else if (cell.isOpened() ||
                inferredData.inferred === InferredValue.SAFE) {
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
        assert(cell.getVisibleState() < 0 ||
            cell.getVisibleState() <=
                unresolvedNeighbors.length + inferredData.adjacentMines, `not enough room for remaining mines: ${JSON.stringify(cell.position)}`);
        if (unresolvedNeighbors.length) {
            if (inferredData.adjacentMines === cell.getVisibleState()) {
                // got all mines. All remaining unresolved neighbors are safe
                for (const neighbor of unresolvedNeighbors) {
                    getInferredData(neighbor).inferred = InferredValue.SAFE;
                    this.workQueue.add(neighbor);
                    // neighbor.open();
                }
            }
            if (cell.getVisibleState() ===
                unresolvedNeighbors.length + inferredData.adjacentMines) {
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
function getInferredData(cell) {
    let inferredData = cell.getAttribute('inferred');
    if (!inferredData) {
        inferredData = {
            adjacentMines: 0,
            adjacentSafe: 0,
        };
        cell.setAttribute('inferred', inferredData);
    }
    return inferredData;
}
function clearInferredData(cell) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZXN3ZWVwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWluZXN3ZWVwZXIvbWluZXN3ZWVwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLHlCQUF5QixFQUN6QixlQUFlLEdBQ2hCLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxFQUFVLE1BQU0sRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ25ELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMzQyxPQUFPLEVBQVksVUFBVSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFeEQscUNBQXFDO0FBQ3JDLE1BQU0sQ0FBTixJQUFZLGdCQWFYO0FBYkQsV0FBWSxnQkFBZ0I7SUFDMUIsdURBQVEsQ0FBQTtJQUNSLHFEQUFPLENBQUE7SUFDUCxxREFBTyxDQUFBO0lBQ1AseURBQVMsQ0FBQTtJQUNULHVEQUFRLENBQUE7SUFDUix1REFBUSxDQUFBO0lBQ1IscURBQU8sQ0FBQTtJQUNQLHlEQUFTLENBQUE7SUFDVCx5REFBUyxDQUFBO0lBQ1QsOERBQVksQ0FBQTtJQUNaLHdEQUFTLENBQUE7SUFDVCx3REFBUyxDQUFBO0FBQ1gsQ0FBQyxFQWJXLGdCQUFnQixLQUFoQixnQkFBZ0IsUUFhM0I7QUFRRCxvRUFBb0U7QUFDcEUsU0FBUyxhQUFhLENBQ3BCLENBQW9CLEVBQ3BCLEtBQWEsRUFDYixNQUFjO0lBRWQsSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMxQixPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFDRCxNQUFNLENBQ0osQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQ25ELHVCQUF1QixDQUN4QixDQUFDO0lBQ0YsT0FBTyxD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