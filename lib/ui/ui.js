import { MineBoard, MineField, CellEventType, BoardEventType, DelayedMineField, OpeningRestrictions, CellVisibleState, } from '../minesweeper/minesweeper.js';
import { BoardIdWorker } from '../minesweeper/board_id_worker.js';
let widthElement;
let heightElement;
let mineCountElement;
let openingConfigElements;
let mineFieldBoard;
let boardIdWorker;
export function initUi(window) {
    window.addEventListener('load', () => {
        // setLoggingLevel(LoggingLevel.TRACE);
        boardIdWorker = new BoardIdWorker();
        widthElement = window.document.getElementById('width');
        heightElement = window.document.getElementById('height');
        mineCountElement = window.document.getElementById('mine_count');
        const sideBar = window.document.getElementById('sidebar');
        openingConfigElements = Array.from(sideBar.querySelectorAll('[name=initial_click]')).filter((e) => e instanceof HTMLInputElement);
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
        window.addEventListener('popstate', () => {
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
        const analyzer = undefined;
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
                    mineCountElement.value = String(board.getView().mineCount);
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
        sideBar.addEventListener('change', e => {
            const element = e.target;
            const name = element?.attributes.getNamedItem('name')?.value;
            if (name === 'color_palette') {
                // changes in color palette don't affect the game
                return;
            }
            const { width, height, mines } = getBoardConfig();
            if (board.getView().width !== width ||
                board.getView().height !== height ||
                board.getView().mineCount !== mines) {
                // legit change to the game
                rebuildGame();
            }
            if (!board.isStarted() && name === 'initial_click') {
                // the opening style changed - rebuild
                rebuildGame();
            }
        });
        const resetButtonListener = (e) => {
            try {
                if (e.button !== 0) {
                    // only care about left click
                    return;
                }
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
    });
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
function getMouseListener(board, _analyzer) {
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
    let mines = mineCountElement.valueAsNumber;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdWkvdWkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLFNBQVMsRUFDVCxTQUFTLEVBRVQsYUFBYSxFQUViLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIsbUJBQW1CLEVBRW5CLGdCQUFnQixHQUdqQixNQUFNLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUVoRSxJQUFJLFlBQThCLENBQUM7QUFDbkMsSUFBSSxhQUErQixDQUFDO0FBQ3BDLElBQUksZ0JBQWtDLENBQUM7QUFDdkMsSUFBSSxxQkFBeUMsQ0FBQztBQUM5QyxJQUFJLGNBQTJCLENBQUM7QUFFaEMsSUFBSSxhQUE0QixDQUFDO0FBRWpDLE1BQU0sVUFBVSxNQUFNLENBQUMsTUFBYztJQUNuQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNuQyx1Q0FBdUM7UUFDdkMsYUFBYSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7UUFFcEMsWUFBWSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBcUIsQ0FBQztRQUMzRSxhQUFhLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQzVDLFFBQVEsQ0FDVyxDQUFDO1FBQ3RCLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUMvQyxZQUFZLENBQ08sQ0FBQztRQUN0QixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FDNUMsU0FBUyxDQUNhLENBQUM7UUFFekIscUJBQXFCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FDaEMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDLENBQ2pELENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUF5QixFQUFFLENBQUMsQ0FBQyxZQUFZ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