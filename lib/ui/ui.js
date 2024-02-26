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
            if (!attributes?.['BUILDING'] && !attributes?.['EXPOSING']) {
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
                                    cell.setWrong();
                                }
                                else {
                                    unflaggedMines.add(cell);
                                }
                            }
                            else if (cell.isFlagged() && !isMine) {
                                cell.setWrong();
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
                    if (!e.attributes?.['BUILDING']) {
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