import { MineBoard, MineField, CellEventType, BoardEventType, DelayedMineField, OpeningRestrictions, CellVisibleState, } from '../minesweeper/minesweeper.js';
import { BoardIdWorker } from '../minesweeper/board_id_worker.js';
let widthElement;
let heightElement;
let mineElement;
let openingConfigElements;
let mineFieldBoard;
let boardIdWorker;
export function initUi(window) {
    window.onload = function () {
        // setLoggingLevel(LoggingLevel.TRACE);
        boardIdWorker = new BoardIdWorker();
        widthElement = window.document.getElementById('width');
        heightElement = window.document.getElementById('height');
        mineElement = window.document.getElementById('mine_count');
        const openingConfigElement = window.document.getElementById('sidebar');
        openingConfigElements = Array.from(openingConfigElement.querySelectorAll('[name=initial_click]')).filter((e) => e instanceof HTMLInputElement);
        mineFieldBoard = window.document.getElementById('minefield');
        const resetButton = window.document.getElementById('reset');
        const resetHeader = window.document.getElementById('header');
        function updateBoardIdDisplay(boardId, replace = false) {
            const url = new URL(location.href);
            if (boardId) {
                url.searchParams.set('board_id', boardId);
            }
            else {
                url.searchParams.delete('board_id');
            }
            if (replace) {
                window.history.replaceState({}, '', url);
            }
            else {
                window.history.pushState({}, '', url);
            }
        }
        window.addEventListener('popstate', e => {
            const url = new URL(location.href);
            const boardId = url.searchParams.get('board_id');
            if (boardId) {
                boardIdWorker.requestDecode(boardId);
            }
            else {
                // close all cells
                board.getAllCells().forEach(c => {
                    c.close();
                    c.flag(false);
                });
            }
        });
        function requestBoardEncode(attributes) {
            if (!attributes?.['DECODING'] && !attributes?.['EXPOSING']) {
                boardIdWorker.requestEncode(board);
            }
        }
        boardIdWorker.addEncodeListener({
            handleEncodeResponse: (id) => {
                updateBoardIdDisplay(id);
            },
        });
        // use a 1x1 mine field as a placeholder until we reset the board
        const board = new MineBoard(new MineField(1, 1, []));
        window['board'] = board;
        boardIdWorker.addDecodeToBoardListener(board);
        const analyzer = undefined; //new SimpleAnalyzer(board);
        // get the board pushing time-elapsed events every 200ms
        board.setClockEventInterval(200);
        const minesRemainingDisplay = new DigitalDisplay([1, 2, 3].map(i => window.document.getElementById('mines_remaining_' + i)));
        function updateMinesRemaining() {
            minesRemainingDisplay.setValue(board.getMinesRemaining());
        }
        const timerDisplay = new DigitalDisplay([1, 2, 3].map(i => window.document.getElementById('timer_' + i)));
        function updateTimer() {
            timerDisplay.setValue(board.getTimeElapsed() / 1000);
        }
        // rebuild the minefield UI
        function boardListener(b, e) {
            switch (e.type) {
                case BoardEventType.MINE_COUNT_CHANGED:
                    updateMinesRemaining();
                    requestBoardEncode(e.attributes);
                    break;
                case BoardEventType.COMPLETE:
                    // use settimeout to allow the event queu to flush before rendering
                    // the "complete" state. This allows the board_id to be properly set
                    // *without* all the exposed flags.
                    setTimeout(() => {
                        for (const cell of board.getAllCells()) {
                            if (!cell.isOpened()) {
                                cell.flag(true, { EXPOSING: true });
                            }
                        }
                        resetButton.innerText = '😎';
                    }, 0);
                    break;
                case BoardEventType.UNCOMPLETE:
                    resetButton.innerText = '🤔';
                    break;
                case BoardEventType.EXPLODE:
                    // use settimeout to allow the event queu to flush before rendering
                    // the "explode" state. This allows the board_id to be properly set
                    // *without* all the exposed mines.
                    setTimeout(() => {
                        const unflaggedMines = new Set();
                        for (const cell of board.getAllCells()) {
                            const isMine = cell.peek() === CellVisibleState.MINE;
                            if (isMine && !cell.isFlagged()) {
                                if (cell.isOpened()) {
                                    // this is the source bomm - mark it wrong
                                    cell.setWrong(true, { EXPOSING: true });
                                }
                                else {
                                    unflaggedMines.add(cell);
                                }
                            }
                            else if (cell.isFlagged() && !isMine) {
                                cell.setWrong(true, { EXPOSING: true });
                            }
                        }
                        // set to "building" mode to supress the board-id generation while
                        // exposing the mines
                        board.openGroup(unflaggedMines, { EXPOSING: true });
                        resetButton.innerText = '😵';
                    }, 0);
                    break;
                case BoardEventType.UNEXPLODE:
                    resetButton.innerText = '🤔';
                    board.getAllCells().forEach(c => c.setWrong(false));
                    break;
                case BoardEventType.TIME_ELAPSED:
                    updateTimer();
                    break;
                case BoardEventType.RESET:
                    resetButton.innerText = '😀';
                    updateMinesRemaining();
                    updateTimer();
                    createBoard(mineFieldBoard, board, analyzer);
                    widthElement.value = String(board.getView().width);
                    heightElement.value = String(board.getView().height);
                    mineElement.value = String(board.getView().mineCount);
                    openingConfigElements
                        .filter(e => e.value === OpeningRestrictions[getBoardConfig().openingConfig])
                        .forEach(e => (e.checked = true));
                    if (!e.attributes?.['DECODING']) {
                        updateBoardIdDisplay('');
                    }
                    break;
                case BoardEventType.FIRST_MOVE:
                    resetButton.innerText = '🤔';
                    break;
                case BoardEventType.CELLS_OPENED:
                    requestBoardEncode(e.attributes);
                    break;
            }
        }
        board.addListener(boardListener);
        function rebuildGame() {
            try {
                const { width, height, mines, openingConfig } = getBoardConfig();
                board.reset(new DelayedMineField(width, height, mines, openingConfig));
            }
            catch (e) {
                logError(e);
            }
        }
        openingConfigElement.addEventListener('change', rebuildGame);
        const resetButtonListener = (e) => {
            try {
                if (e.button !== 0) {
                    // only care about left click
                    return;
                }
                const { width, height, mineCount: mines } = board.getView();
                switch (e.type) {
                    case 'mousedown':
                        resetButton.classList.add('pressed');
                        break;
                    case 'mouseup':
                        resetButton.classList.remove('pressed');
                        rebuildGame();
                        break;
                    case 'mouseenter':
                        if (e.buttons === 1) {
                            resetButton.classList.add('pressed');
                        }
                        break;
                    case 'mouseleave':
                        if (e.buttons === 1) {
                            resetButton.classList.remove('pressed');
                        }
                        break;
                }
            }
            catch (e) {
                logError(e);
            }
        };
        resetHeader.addEventListener('mousedown', resetButtonListener);
        resetHeader.addEventListener('mouseup', resetButtonListener);
        resetHeader.addEventListener('mouseenter', resetButtonListener);
        resetHeader.addEventListener('mouseleave', resetButtonListener);
        const url = new URL(location.href);
        const boardId = url.searchParams.get('board_id');
        if (boardId) {
            boardIdWorker.requestDecode(boardId);
        }
        else {
            rebuildGame();
        }
    };
}
function createBoard(uiContainer, board, analyzer) {
    // reset container
    uiContainer.innerHTML = '';
    const { width: w, height: h } = board.getView();
    const elements = [];
    const cellListener = getCellListener(board);
    const uiListener = getMouseListener(board, analyzer);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const elem = document.createElement('div');
            elem.classList.add('cell');
            elem.classList.add('closed');
            elem.style.setProperty('grid-row', String(y + 1));
            elem.setAttribute('x', String(x));
            elem.setAttribute('y', String(y));
            const cell = board.getCell(x, y);
            cell.setAttribute('element', elem);
            cell.addListener(cellListener);
            elem.addEventListener('mousedown', uiListener);
            elem.addEventListener('mouseup', uiListener);
            elem.addEventListener('mouseenter', uiListener);
            elem.addEventListener('mouseleave', uiListener);
            uiContainer.appendChild(elem);
        }
    }
    return elements.join('\n');
}
function getCellListener(board) {
    return (cell, event) => {
        const elem = cell.getAttribute('element');
        if (!elem) {
            return;
        }
        switch (event.type) {
            case CellEventType.OPEN:
                elem.classList.remove('closed');
                elem.classList.add('open');
                elem.classList.remove('pressed');
                if (cell.peek() < 0) {
                    elem.classList.add('mine');
                }
                else if (cell.peek() > 0) {
                    if (!board.isExploded()) {
                        elem.classList.add('n' + cell.peek());
                    }
                }
                break;
            case CellEventType.CLOSE:
                elem.classList.remove('open');
                elem.classList.add('closed');
                elem.classList.remove('pressed');
                elem.classList.remove('mine');
                elem.classList.remove('wrong');
                elem.classList.remove('n1');
                elem.classList.remove('n2');
                elem.classList.remove('n3');
                elem.classList.remove('n4');
                elem.classList.remove('n5');
                elem.classList.remove('n6');
                elem.classList.remove('n7');
                elem.classList.remove('n8');
                break;
            case CellEventType.RESET:
                for (const clz of Array.from(elem.classList)) {
                    if (clz !== 'cell') {
                        elem.classList.remove(clz);
                    }
                    elem.classList.add('closed');
                }
                break;
            case CellEventType.FLAG:
                if (cell.isFlagged()) {
                    elem.classList.add('flagged');
                }
                else {
                    elem.classList.remove('flagged');
                }
                break;
            case CellEventType.WRONG:
                if (cell.isWrong()) {
                    elem.classList.add('wrong');
                }
                else {
                    elem.classList.remove('wrong');
                }
                break;
            case CellEventType.PRESS:
                if (cell.isPressed()) {
                    elem.classList.add('pressed');
                }
                else {
                    // remove the "pressed" class from this and adjacent cells
                    elem.classList.remove('pressed');
                }
        }
    };
}
function getMouseListener(board, analyzer) {
    return (event) => {
        // const e = {
        //   type: event.type,
        //   altKey: event.altKey,
        //   button: event.button,
        //   buttons: event.buttons,
        // };
        // console.log(`Mouse event: ${JSON.stringify(e)}`, event.target);
        const position = getPosition(event.target);
        if (!position) {
            return;
        }
        const cell = board.getCell(position.x, position.y);
        if (!cell) {
            return;
        }
        event.preventDefault();
        if (board.isExploded() || board.isComplete()) {
            // no more action until game is reset
            return;
        }
        if (event.button === 2 && event.type === 'mousedown') {
            // right press. Either flag if unopened, or chord
            if (cell.isOpened()) {
                cell.chord();
            }
            else {
                // right click - toggle flag
                cell.flag(!cell.isFlagged());
            }
        }
        if (event.button === 0 && event.type === 'mouseup') {
            if (!cell.isFlagged() && !cell.isOpened()) {
                cell.open();
            }
            else if (cell.isOpened()) {
                cell.chord();
            }
        }
        if ((event.button === 0 && event.type === 'mousedown') ||
            (event.buttons === 1 && event.type === 'mouseenter')) {
            cell.pressCellOrChord();
        }
        if ((event.button === 0 && event.type === 'mouseup') ||
            (event.buttons === 1 && event.type === 'mouseleave')) {
            // left release.  Unpress, and open
            cell.pressCellOrChord(false);
        }
    };
}
function getPosition(cell) {
    if (cell instanceof HTMLElement) {
        const xVal = cell.getAttribute('x');
        const yVal = cell.getAttribute('y');
        if (xVal && yVal && /^[0-9]+$/.test(xVal) && /^[0-9]+$/.test(yVal)) {
            return { x: parseInt(xVal), y: parseInt(yVal) };
        }
        else {
            // try parent
            return getPosition(cell.parentElement);
        }
    }
    return null;
}
class DigitalDisplay {
    cells;
    constructor(cells) {
        this.cells = cells;
    }
    setValue(val) {
        function leftPad(v, len, c) {
            return (new Array(Math.max(len - v.length, 0)).fill(c).join('') + v);
        }
        if (typeof val === 'number') {
            // truncate and left pad with zeros
            val = Math.trunc(val);
            let neg = '';
            if (val < 0) {
                neg = '-';
                val = -val;
            }
            if (val >= 10 ** (this.cells.length - neg.length)) {
                val = neg + leftPad('', this.cells.length - neg.length, '9');
            }
            else {
                val = leftPad(neg + val.toString(), this.cells.length, '0');
            }
        }
        else {
            // string
            if (val.length < this.cells.length) {
                val = leftPad(val, this.cells.length, ' ');
            }
            else {
                val = val.substring(0, this.cells.length);
            }
        }
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i].innerText = val[i];
        }
    }
}
function getBoardConfig() {
    let width = widthElement.valueAsNumber;
    let height = heightElement.valueAsNumber;
    let mines = mineElement.valueAsNumber;
    const openingConfigValue = openingConfigElements.find(e => e.checked)
        ?.value;
    let openingConfig = OpeningRestrictions[openingConfigValue] ?? OpeningRestrictions.ANY;
    if (isNaN(width) || width < 1) {
        width = 1;
    }
    if (isNaN(height) || height < 1) {
        height = 1;
    }
    const cellCount = width * height;
    if (isNaN(mines) || mines < 1) {
        mines = 0;
    }
    else if (mines > cellCount) {
        mines = cellCount;
    }
    if (mines === cellCount) {
        // No room for a non-mine opening
        openingConfig = OpeningRestrictions.ANY;
    }
    else if (mines > cellCount - 9) {
        if (openingConfig === OpeningRestrictions.ZERO) {
            // no room for a zero opening
            openingConfig = OpeningRestrictions.ANY;
        }
    }
    return { width, height, mines, openingConfig };
}
function logError(e) {
    console.log(e);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdWkvdWkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLFNBQVMsRUFDVCxTQUFTLEVBRVQsYUFBYSxFQUViLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIsbUJBQW1CLEVBRW5CLGdCQUFnQixHQUdqQixNQUFNLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUVsRSxJQUFJLFlBQThCLENBQUM7QUFDbkMsSUFBSSxhQUErQixDQUFDO0FBQ3BDLElBQUksV0FBNkIsQ0FBQztBQUNsQyxJQUFJLHFCQUF5QyxDQUFDO0FBQzlDLElBQUksY0FBMkIsQ0FBQztBQUVoQyxJQUFJLGFBQTRCLENBQUM7QUFFakMsTUFBTSxVQUFVLE1BQU0sQ0FBQyxNQUFjO0lBQ25DLE1BQU0sQ0FBQyxNQUFNLEdBQUc7UUFDZCx1Q0FBdUM7UUFDdkMsYUFBYSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7UUFFcEMsWUFBWSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBcUIsQ0FBQztRQUMzRSxhQUFhLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQzVDLFFBQVEsQ0FDVyxDQUFDO1FBQ3RCLFdBQVcsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FDMUMsWUFBWSxDQUNPLENBQUM7UUFDdEIsTUFBTSxvQkFBb0IsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FDekQsU0FBUyxDQUNhLENBQUM7UUFFekIscUJBQXFCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FDaEMsb0JBQW9CLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUMsQ0FDOUQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQXlCLEVBQUUsQ0FBQyxDQUFDLFlBQVksZ0JBQWdCLENBQUMsQ0FBQztRQUV0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