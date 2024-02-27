import {
  MineBoard,
  MineField,
  Cell,
  CellEventType,
  Position,
  BoardEventType,
  DelayedMineField,
  OpeningRestrictions,
  SimpleAnalyzer,
  CellVisibleState,
  CellEvent,
  BoardEvent,
} from '../minesweeper/minesweeper.js';
import { BoardIdWorker } from '../minesweeper/board_id_worker.js';

let widthElement: HTMLInputElement;
let heightElement: HTMLInputElement;
let mineCountElement: HTMLInputElement;
let openingConfigElements: HTMLInputElement[];
let mineFieldBoard: HTMLElement;

let boardIdWorker: BoardIdWorker;

export function initUi(window: Window) {
  window.addEventListener('load', () => {
    // setLoggingLevel(LoggingLevel.TRACE);
    boardIdWorker = new BoardIdWorker();

    widthElement = window.document.getElementById('width') as HTMLInputElement;
    heightElement = window.document.getElementById(
      'height'
    ) as HTMLInputElement;
    mineCountElement = window.document.getElementById(
      'mine_count'
    ) as HTMLInputElement;
    const sideBar = window.document.getElementById(
      'sidebar'
    ) as HTMLFieldSetElement;

    openingConfigElements = Array.from(
      sideBar.querySelectorAll('[name=initial_click]')
    ).filter((e): e is HTMLInputElement => e instanceof HTMLInputElement);

    mineFieldBoard = window.document.getElementById('minefield') as HTMLElement;

    const resetButton = window.document.getElementById('reset') as HTMLElement;
    const resetHeader = window.document.getElementById('header') as HTMLElement;

    function updateBoardIdDisplay(boardId: string, replace = false) {
      const url = new URL(location.href);
      if (boardId) {
        url.searchParams.set('board_id', boardId);
      } else {
        url.searchParams.delete('board_id');
      }
      if (replace) {
        window.history.replaceState({}, '', url);
      } else {
        window.history.pushState({}, '', url);
      }
    }
    window.addEventListener('popstate', e => {
      const url = new URL(location.href);
      const boardId = url.searchParams.get('board_id');
      if (boardId) {
        boardIdWorker.requestDecode(boardId);
      } else {
        // close all cells
        board.getAllCells().forEach(c => {
          c.close();
          c.flag(false);
        });
      }
    });

    function requestBoardEncode(attributes?: Record<string, unknown>) {
      if (!attributes?.['DECODING'] && !attributes?.['EXPOSING']) {
        boardIdWorker.requestEncode(board);
      }
    }
    boardIdWorker.addEncodeListener({
      handleEncodeResponse: (id: string) => {
        updateBoardIdDisplay(id);
      },
    });

    // use a 1x1 mine field as a placeholder until we reset the board
    const board = new MineBoard(new MineField(1, 1, []));
    (window as unknown as Record<string, unknown>)['board'] = board;
    boardIdWorker.addDecodeToBoardListener(board);

    const analyzer: SimpleAnalyzer | undefined = undefined; //new SimpleAnalyzer(board);

    // get the board pushing time-elapsed events every 200ms
    board.setClockEventInterval(200);

    const minesRemainingDisplay = new DigitalDisplay(
      [1, 2, 3].map(i =>
        window.document.getElementById('mines_remaining_' + i)
      ) as HTMLElement[]
    );

    function updateMinesRemaining() {
      minesRemainingDisplay.setValue(board.getMinesRemaining());
    }

    const timerDisplay = new DigitalDisplay(
      [1, 2, 3].map(i =>
        window.document.getElementById('timer_' + i)
      ) as HTMLElement[]
    );
    function updateTimer() {
      timerDisplay.setValue(board.getTimeElapsed() / 1000);
    }

    // rebuild the minefield UI
    function boardListener(b: MineBoard, e: BoardEvent) {
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
            const unflaggedMines = new Set<Cell>();
            for (const cell of board.getAllCells()) {
              const isMine = cell.peek() === CellVisibleState.MINE;
              if (isMine && !cell.isFlagged()) {
                if (cell.isOpened()) {
                  // this is the source bomm - mark it wrong
                  cell.setWrong(true, { EXPOSING: true });
                } else {
                  unflaggedMines.add(cell);
                }
              } else if (cell.isFlagged() && !isMine) {
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
            .filter(
              e =>
                e.value === OpeningRestrictions[getBoardConfig().openingConfig]
            )
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
      } catch (e) {
        logError(e);
      }
    }
    sideBar.addEventListener('change', e => {
      const element = e.target as HTMLElement;
      const name = element?.attributes.getNamedItem('name')?.value;

      if (name === 'color_palette') {
        // changes in color palette don't affect the game
        return;
      }
      const { width, height, mines, openingConfig } = getBoardConfig();
      if (
        board.getView().width !== width ||
        board.getView().height !== height ||
        board.getView().mineCount !== mines
      ) {
        // legit change to the game
        rebuildGame();
      }
      if (!board.isStarted() && name === 'initial_click') {
        // the opening style changed - rebuild
        rebuildGame();
      }
    });

    const resetButtonListener = (e: MouseEvent) => {
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
      } catch (e) {
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
    } else {
      rebuildGame();
    }
  });
}

function createBoard(
  uiContainer: HTMLElement,
  board: MineBoard,
  analyzer?: SimpleAnalyzer
): string {
  // reset container
  uiContainer.innerHTML = '';
  const { width: w, height: h } = board.getView();

  const elements: string[] = [];
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

function getCellListener(board: MineBoard) {
  return (cell: Cell, event: CellEvent) => {
    const elem = cell.getAttribute('element') as HTMLElement;
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
        } else if (cell.peek() > 0) {
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
        } else {
          elem.classList.remove('flagged');
        }
        break;
      case CellEventType.WRONG:
        if (cell.isWrong()) {
          elem.classList.add('wrong');
        } else {
          elem.classList.remove('wrong');
        }
        break;
      case CellEventType.PRESS:
        if (cell.isPressed()) {
          elem.classList.add('pressed');
        } else {
          // remove the "pressed" class from this and adjacent cells
          elem.classList.remove('pressed');
        }
    }
  };
}

function getMouseListener(board: MineBoard, analyzer?: SimpleAnalyzer) {
  return (event: MouseEvent) => {
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
      } else {
        // right click - toggle flag
        cell.flag(!cell.isFlagged());
      }
    }
    if (event.button === 0 && event.type === 'mouseup') {
      if (!cell.isFlagged() && !cell.isOpened()) {
        cell.open();
      } else if (cell.isOpened()) {
        cell.chord();
      }
    }
    if (
      (event.button === 0 && event.type === 'mousedown') ||
      (event.buttons === 1 && event.type === 'mouseenter')
    ) {
      cell.pressCellOrChord();
    }
    if (
      (event.button === 0 && event.type === 'mouseup') ||
      (event.buttons === 1 && event.type === 'mouseleave')
    ) {
      // left release.  Unpress, and open
      cell.pressCellOrChord(false);
    }
  };
}

function getPosition(cell: unknown): Position | null {
  if (cell instanceof HTMLElement) {
    const xVal = cell.getAttribute('x');
    const yVal = cell.getAttribute('y');
    if (xVal && yVal && /^[0-9]+$/.test(xVal) && /^[0-9]+$/.test(yVal)) {
      return { x: parseInt(xVal), y: parseInt(yVal) };
    } else {
      // try parent
      return getPosition(cell.parentElement);
    }
  }
  return null;
}

class DigitalDisplay {
  constructor(private readonly cells: HTMLElement[]) {}

  setValue(val: number | string) {
    function leftPad(v: string, len: number, c: string): string {
      return (
        new Array<string>(Math.max(len - v.length, 0)).fill(c).join('') + v
      );
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
      } else {
        val = leftPad(neg + val.toString(), this.cells.length, '0');
      }
    } else {
      // string
      if (val.length < this.cells.length) {
        val = leftPad(val, this.cells.length, ' ');
      } else {
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
    ?.value as keyof typeof OpeningRestrictions;
  let openingConfig =
    OpeningRestrictions[openingConfigValue] ?? OpeningRestrictions.ANY;

  if (isNaN(width) || width < 1) {
    width = 1;
  }
  if (isNaN(height) || height < 1) {
    height = 1;
  }
  const cellCount = width * height;
  if (isNaN(mines) || mines < 1) {
    mines = 0;
  } else if (mines > cellCount) {
    mines = cellCount;
  }
  if (mines === cellCount) {
    // No room for a non-mine opening
    openingConfig = OpeningRestrictions.ANY;
  } else if (mines > cellCount - 9) {
    if (openingConfig === OpeningRestrictions.ZERO) {
      // no room for a zero opening
      openingConfig = OpeningRestrictions.ANY;
    }
  }
  return { width, height, mines, openingConfig };
}

function logError(e: unknown) {
  console.log(e);
}
