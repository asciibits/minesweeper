import {
  MineBoard,
  MineField,
  Cell,
  CellEventType,
  Position,
  BoardEventType,
  DelayedMineField,
  OpeningRestrictions,
  CellVisibleState,
  CellEvent,
  BoardEvent,
} from '../minesweeper/minesweeper.js';
import {
  BoardIdWorker,
  EncodeBoardIdListener,
} from '../minesweeper/board_id_worker.js';
import {
  EncodedBoardState,
  KnownBoardState,
  applyBoardState,
  decodeBoardState,
} from '../minesweeper/minesweeper_storage.js';

/** Initialize the UI */
export function initUi(win: Window) {
  let ui: MinesweeperUi;

  const url = new URL(win.location.href);
  const boardId = url.searchParams.get('board_id');
  if (boardId) {
    const viewState = url.searchParams.get('view_state') ?? undefined;
    const elapsedTime = url.searchParams.get('elapsed_time') ?? undefined;
    ui = new MinesweeperUi(win, boardId, viewState, elapsedTime);
  } else {
    ui = new MinesweeperUi(win);
  }

  // for debugging in the UI, make the board available to the console
  (win as unknown as Record<string, unknown>)['minesweeper'] = ui;
}

/** A Class to manage all the UI elements of the game */
class MinesweeperUi implements EncodeBoardIdListener {
  // the Board data
  private readonly board: MineBoard;
  private readonly boardIdWorker: BoardIdWorker;

  // the UI elements
  private readonly boardMenu: HTMLFieldSetElement;
  private readonly widthElement: HTMLInputElement;
  private readonly heightElement: HTMLInputElement;
  private readonly mineCountElement: HTMLInputElement;
  private readonly bodyElement: HTMLBodyElement;
  private readonly mineFieldBoard: HTMLElement;
  private readonly minefieldBoardWrapper: HTMLElement;
  private readonly resetButton: HTMLElement;
  private readonly resetHeader: HTMLElement;
  private readonly openingConfigElements: HTMLInputElement[];
  private readonly minesRemainingDisplay: DigitalDisplay;
  private readonly timerDisplay: DigitalDisplay;

  // handler state
  private resetMouseDownButtons = 0;
  private cellMouseDownButtons = 0;
  private touchStart?: Partial<Touch>;

  constructor(
    private readonly win: Window,
    boardId?: string,
    viewState?: string,
    elapsedTime?: string,
  ) {
    // Initialize the board
    this.board = new MineBoard(new MineField(1, 1, []));
    this.board.setClockEventInterval(200);
    this.board.addListener((_, e) => this.handleBoardEvent(e));

    // Initialize the boardIdWorker
    this.boardIdWorker = initBoardIdWorker(win, this.board);
    this.boardIdWorker.addEncodeListener(this);

    // initialize the UI elements
    const elements = getDocumentElements(win);
    this.boardMenu = elements.boardMenu;
    this.widthElement = elements.widthElement;
    this.heightElement = elements.heightElement;
    this.mineCountElement = elements.mineCountElement;
    this.bodyElement = elements.bodyElement;
    this.mineFieldBoard = elements.mineFieldBoard;
    this.minefieldBoardWrapper = elements.minefieldBoardWrapper;
    this.resetButton = elements.resetButton;
    this.resetHeader = elements.resetHeader;
    this.openingConfigElements = elements.openingConfigElements;
    this.minesRemainingDisplay = new DigitalDisplay(
      elements.minesRemainingElements,
    );
    this.timerDisplay = new DigitalDisplay(elements.timerElements);

    // set up the UI listeners
    this.boardMenu.addEventListener('change', e => this.handleMenuEvent(e));
    this.resetButton.addEventListener('click', () => this.rebuildMineField());
    const resetHandler = (e: MouseEvent) => this.handleResetEvent(e);
    this.resetHeader.addEventListener('mousedown', resetHandler);
    this.resetHeader.addEventListener('mouseup', resetHandler);
    this.resetHeader.addEventListener('mouseout', resetHandler);
    this.resetHeader.addEventListener('mouseover', resetHandler);

    // perform the initial game build
    this.rebuildMineField(boardId, viewState, elapsedTime);
  }

  private requestBoardEncode(attributes?: Record<string, unknown>) {
    if (!attributes?.['DECODING'] && !attributes?.['EXPOSING']) {
      this.boardIdWorker.requestEncode(this.board);
    }
  }

  private updateMinesRemaining() {
    this.minesRemainingDisplay.setValue(this.board.getMinesRemaining());
  }
  private updateTimer() {
    this.timerDisplay.setValue(this.board.getTimeElapsed() / 1000);
  }

  private handleBoardEvent(e: BoardEvent) {
    switch (e.type) {
      case BoardEventType.MINE_COUNT_CHANGED:
        this.updateMinesRemaining();
        this.requestBoardEncode(e.attributes);
        break;
      case BoardEventType.COMPLETE:
        // use settimeout to allow the event queu to flush before rendering
        // the "complete" state. This allows the board_id to be properly set
        // *without* all the exposed flags.
        setTimeout(() => {
          for (const cell of this.board.getAllCells()) {
            if (!cell.isOpened()) {
              cell.flag(true, {EXPOSING: true});
            }
          }
          this.resetButton.innerText = '😎';
        }, 0);
        break;
      case BoardEventType.UNCOMPLETE:
        this.resetButton.innerText = '🤔';
        break;
      case BoardEventType.EXPLODE:
        // use settimeout to allow the event queu to flush before rendering
        // the "explode" state. This allows the board_id to be properly set
        // *without* all the exposed mines.
        setTimeout(() => {
          const unflaggedMines = new Set<Cell>();
          for (const cell of this.board.getAllCells()) {
            const isMine = cell.peek() === CellVisibleState.MINE;
            if (isMine && !cell.isFlagged()) {
              if (cell.isOpened()) {
                // this is the source bomm - mark it wrong
                cell.setWrong(true, {EXPOSING: true});
              } else {
                unflaggedMines.add(cell);
              }
            } else if (cell.isFlagged() && !isMine) {
              cell.setWrong(true, {EXPOSING: true});
            }
          }
          // set to "building" mode to supress the board-id generation while
          // exposing the mines
          this.board.openGroup(unflaggedMines, {EXPOSING: true});
          this.resetButton.innerText = '😵';
        }, 0);
        break;
      case BoardEventType.UNEXPLODE:
        this.resetButton.innerText = '🤔';
        this.board.getAllCells().forEach(c => c.setWrong(false));
        break;
      case BoardEventType.TIME_ELAPSED:
        this.updateTimer();
        break;
      case BoardEventType.RESET:
        this.resetButton.innerText = '😀';
        this.updateMinesRemaining();
        this.updateTimer();
        this.resetBoard();
        this.widthElement.value = String(this.board.getView().width);
        this.heightElement.value = String(this.board.getView().height);
        this.mineCountElement.value = String(this.board.getView().mineCount);
        this.openingConfigElements
          .filter(
            e =>
              e.value ===
              OpeningRestrictions[this.getBoardConfig().openingConfig],
          )
          .forEach(e => (e.checked = true));
        if (!e.attributes?.['DECODING']) {
          this.bodyElement.classList.remove('in_progress');
          this.updateBoardId();
        }
        this.minefieldBoardWrapper.classList.remove('blank');
        break;
      case BoardEventType.FIRST_MOVE:
        this.resetButton.innerText = '🤔';
        this.bodyElement.classList.add('in_progress');
        break;
      case BoardEventType.CELLS_OPENED:
        this.requestBoardEncode(e.attributes);
        break;
    }
  }

  private handleCellEvent(cell: Cell, event: CellEvent) {
    const elem = cell.getAttribute('element') as HTMLButtonElement;
    if (!elem) {
      return;
    }
    switch (event.type) {
      case CellEventType.OPEN:
        elem.classList.remove('closed');
        elem.classList.add('open');
        elem.classList.remove('pressed');
        if (cell.peek() < 0) {
          elem.textContent = '*';
          elem.classList.add('mine');
        } else {
          if (!this.board.isExploded()) {
            elem.textContent = cell.peek().toString();
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
        elem.textContent = '';
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
          if (!cell.isOpened()) {
            elem.textContent = '`';
          }
        } else {
          elem.classList.remove('flagged');
          if (!cell.isOpened()) {
            elem.textContent = '';
          }
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
  }

  private handleCellMouseEvent(event: MouseEvent) {
    const cell = this.getCellForUiEvent(event);
    if (!cell) {
      return;
    }
    switch (event.type) {
      case 'mousedown':
        this.cellMouseDownButtons |= event.buttons;
        if (event.buttons & 1) {
          // left-click - show cells as 'pressed'
          cell.pressCellOrChord();
        } else if (event.buttons & 2) {
          // right-click - Either flag if unopened, or chord
          processFlag(cell);
        }
        // don't prevent default on mouse-down. This allows the 'click' event
        // to fire, which handles focus properly
        return;
      case 'mouseup':
        const releasedButtons = this.cellMouseDownButtons & ~event.buttons;
        this.cellMouseDownButtons &= event.buttons;
        cell.pressCellOrChord(false);
        if (releasedButtons & 1) {
          processClick(cell);
        }
        break;
      case 'mouseenter':
        this.cellMouseDownButtons &= event.buttons;
        // use `buttons` (plural) which has info for enter events
        if (this.cellMouseDownButtons & 1) {
          // If the user clicks the left button and drags it around the board,
          // this keeps the cells under the cursor visually 'pressed'
          cell.pressCellOrChord();
        }
        break;
      case 'mouseleave':
        cell.pressCellOrChord(false);
        break;
    }
    event.preventDefault();
  }

  private handleCellTouchEvent(event: TouchEvent) {
    const cell = this.getCellForUiEvent(event);
    if (!cell) {
      return;
    }
    const touches = event.touches.length ? event.touches : event.changedTouches;
    if (touches.length !== 1) {
      // only handle single press
      this.touchStart = undefined;
      return;
    }
    const touch = touches[0];
    if (this.touchStart && touch.identifier !== this.touchStart.identifier) {
      // different touch action - clear the start state
      this.touchStart = undefined;
    }

    switch (event.type) {
      case 'touchstart':
        const {identifier, screenX, screenY} = touch;
        this.touchStart = {
          identifier,
          screenX,
          screenY,
        };
        // allow default actions
        return;
      case 'touchend':
        if (!this.touchStart) {
          // no matching start for this end - nothing to do
          return undefined;
        }
        // get the width of one square
        const cellElement = cell.getAttribute('element') as HTMLElement;
        const {width, height} = cellElement?.getBoundingClientRect?.() ?? {
          width: 0,
          height: 0,
        };
        const scale = this.win.visualViewport?.scale ?? 1;
        const dx = Math.abs(touch.screenX - (this.touchStart?.screenX ?? 0));
        const dy = Math.abs(touch.screenY - (this.touchStart?.screenY ?? 0));
        console.log('Got touch: %o', {
          touch,
          scale,
          touchStart: this.touchStart,
        });
        if (dx <= width * scale && dy <= height * scale) {
          // we have a legit touch!
          if (event.cancelable) {
            event.preventDefault();
          }
          processClick(cell);
        }
        break;
      default:
        return;
    }
  }

  private handleCellKeyEvent(event: KeyboardEvent) {
    const cell = this.getCellForUiEvent(event);
    if (!cell) {
      return;
    }
    let {x, y} = cell.position;
    const {width, height} = this.board.getView();
    let refocus = false;

    switch (event.key) {
      case 'ArrowUp':
        y--;
        refocus = true;
        break;
      case 'ArrowDown':
        y++;
        refocus = true;
        break;
      case 'ArrowLeft':
        x--;
        refocus = true;
        break;
      case 'ArrowRight':
        x++;
        refocus = true;
        break;
      case 'Enter':
      case ' ':
        // capture space so we handle the click on 'keydown' rather than
        // 'keypressed' - it seems more agile in a game environment
        processClick(cell);
        break;
      case 'f':
        processFlag(cell);
        break;
      case 'Escape':
        // move focus to the reset button
        this.resetButton.focus();
        break;
      default:
        // allow other keystrokes to bubble
        return;
    }
    event.preventDefault();
    if (refocus) {
      (
        this.board
          .getCell((x + width) % width, (y + height) % height)
          ?.getAttribute('element') as HTMLButtonElement
      )?.focus();
    }
  }

  private handleMenuEvent(e: Event) {
    if (e.defaultPrevented) return;
    if (this.board.isStarted()) {
      // don't make changes to an in-progress game
      return;
    }
    e.preventDefault();
    this.rebuildMineField();
  }

  private handleResetEvent(e: MouseEvent) {
    if (e.defaultPrevented) return;
    if (e.target !== this.resetHeader) {
      // ignore events happening on children - relies on css
      // "pointer-events: none" for immediate children, then enabled again on
      // their descendents.
      return;
    }
    try {
      switch (e.type) {
        case 'mousedown':
          this.resetMouseDownButtons = e.buttons;
          if (this.resetMouseDownButtons & 1) {
            this.resetButton.classList.add('pressed');
          }
          // allow the default action to percolate - this allows the reset
          // button to get focus
          return;
        case 'mouseup':
          // For touch screens, they never get the 'mousedown' event, so give
          // them a chance to animate the button press
          const releasedButtons = this.resetMouseDownButtons & ~e.buttons;
          this.resetMouseDownButtons &= e.buttons;
          if (releasedButtons & 1) {
            this.resetButton.classList.add('pressed');
            setTimeout(() => {
              this.resetButton.classList.remove('pressed');
              this.resetButton.click();
            }, 0);
          }
          break;
        case 'mouseover':
          this.resetMouseDownButtons &= e.buttons;
          if (this.resetMouseDownButtons & 1) {
            this.resetButton.classList.add('pressed');
          }
          break;
        case 'mouseout':
          this.resetButton.classList.remove('pressed');
          break;
      }
      e.preventDefault();
    } catch (e) {
      logError(e);
    }
  }

  /** Handle an asyncronous 'encode board id' response */
  handleEncodeResponse(encodedBoardState: EncodedBoardState) {
    this.updateBoardId(encodedBoardState);
  }

  /**
   * Update the Game field for a new board
   */
  private resetBoard() {
    // reset container
    this.mineFieldBoard.innerHTML = '';
    const {width: w, height: h} = this.board.getView();

    const cellListener = (c: Cell, e: CellEvent) => this.handleCellEvent(c, e);
    const mouseListener = (e: MouseEvent) => this.handleCellMouseEvent(e);
    const touchListener = (e: TouchEvent) => this.handleCellTouchEvent(e);
    const keyListener = (e: KeyboardEvent) => this.handleCellKeyEvent(e);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const elem = document.createElement('button');
        elem.classList.add('cell');
        elem.classList.add('closed');
        elem.style.setProperty('grid-row', String(y + 1));
        elem.setAttribute('x', String(x));
        elem.setAttribute('y', String(y));

        const cell = this.board.getCell(x, y);
        cell.setAttribute('element', elem);

        cell.addListener(cellListener);
        elem.addEventListener('mousedown', mouseListener);
        elem.addEventListener('mouseup', mouseListener);
        elem.addEventListener('mouseenter', mouseListener);
        elem.addEventListener('mouseleave', mouseListener);
        elem.addEventListener('touchstart', touchListener);
        elem.addEventListener('touchend', touchListener);
        elem.addEventListener('keydown', keyListener);
        this.mineFieldBoard.appendChild(elem);
      }
    }
  }

  /** Update the URL parameters for a new board id */
  private updateBoardId(state?: EncodedBoardState, replace = false) {
    const url = new URL(location.href);
    if (state?.boardId) {
      url.searchParams.set('board_id', state?.boardId);
      if (state?.viewState) {
        url.searchParams.set('view_state', state?.viewState);
      } else {
        url.searchParams.delete('view_state');
      }
      if (state?.elapsedTime) {
        url.searchParams.set('elapsed_time', state?.elapsedTime);
      } else {
        url.searchParams.delete('elapsed_time');
      }
    } else {
      url.searchParams.delete('board_id');
      url.searchParams.delete('view_state');
      url.searchParams.delete('elapsed_time');
    }
    if (replace) {
      this.win.history.replaceState({}, '', url);
    } else {
      this.win.history.pushState({}, '', url);
    }
  }

  /** Rebuild the  */
  private rebuildMineField(): void;
  private rebuildMineField(
    boardId?: string,
    viewState?: string,
    elapsedTime?: string,
  ): void;
  private rebuildMineField(boardState: KnownBoardState): void;
  private rebuildMineField(
    boardIdOrState?: KnownBoardState | string,
    viewState?: string,
    elapsedTime?: string,
  ): void {
    if (boardIdOrState) {
      let state: KnownBoardState;
      if (typeof boardIdOrState === 'string') {
        state = decodeBoardState({
          boardId: boardIdOrState,
          viewState,
          elapsedTime,
        });
      } else {
        state = boardIdOrState;
      }
      applyBoardState(this.board, state, {DECODING: true});
    } else {
      const {width, height, mines, openingConfig} = this.getBoardConfig();
      // use a mine field that delays creation until the initial click
      this.board.reset(
        new DelayedMineField(width, height, mines, openingConfig),
      );
    }
  }

  private getBoardConfig() {
    let width = this.widthElement.valueAsNumber;
    let height = this.heightElement.valueAsNumber;
    let mines = this.mineCountElement.valueAsNumber;
    const openingConfigValue = this.openingConfigElements.find(e => e.checked)
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
    return {width, height, mines, openingConfig};
  }

  private getCellForUiEvent(
    event: MouseEvent | KeyboardEvent | TouchEvent,
  ): Cell | undefined {
    if (event.defaultPrevented) return undefined;

    if (this.board.isExploded() || this.board.isComplete()) {
      // no more action until game is reset
      return undefined;
    }
    if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
      // don't handle any of the modified keys
      return undefined;
    }

    const position = getPosition(event.target);
    const {x, y} = position ?? {x: 0, y: 0};
    return this.board.getCell(x, y);
  }
}

function processClick(cell: Cell) {
  if (cell.isOpened()) {
    cell.chord();
  } else if (!cell.isFlagged()) {
    cell.open();
  }
}

function processFlag(cell: Cell) {
  if (cell.isOpened()) {
    // using the 'flag' button to open a chord is non-standard, but very handy.
    // I should make it an option
    cell.chord();
  } else {
    cell.flag(!cell.isFlagged());
  }
}

function getPosition(cell: unknown): Position | null {
  if (cell instanceof HTMLElement) {
    const xVal = cell.getAttribute('x');
    const yVal = cell.getAttribute('y');
    if (xVal && yVal && /^[0-9]+$/.test(xVal) && /^[0-9]+$/.test(yVal)) {
      return {x: parseInt(xVal), y: parseInt(yVal)};
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

function logError(e: unknown) {
  console.log(e);
}

function initBoardIdWorker(win: Window, board: MineBoard) {
  const boardIdWorker = new BoardIdWorker();

  win.addEventListener('popstate', () => {
    const url = new URL(location.href);
    const boardId = url.searchParams.get('board_id');
    const viewState = url.searchParams.get('view_state') ?? undefined;
    const elapsedTime = url.searchParams.get('elapsed_time') ?? undefined;
    if (boardId) {
      boardIdWorker.requestDecode({boardId, viewState, elapsedTime});
    } else {
      // close all cells
      board.getAllCells().forEach(c => {
        c.close();
        c.flag(false);
      });
    }
  });

  boardIdWorker.addDecodeToBoardListener(board);
  return boardIdWorker;
}

function getDocumentElements(win: Window) {
  const boardMenu = win.document.getElementById(
    'board_menu',
  ) as HTMLFieldSetElement;

  const widthElement = win.document.getElementById('width') as HTMLInputElement;
  const heightElement = win.document.getElementById(
    'height',
  ) as HTMLInputElement;
  const mineCountElement = win.document.getElementById(
    'mines',
  ) as HTMLInputElement;
  const bodyElement = win.document.getElementsByTagName(
    'body',
  )[0] as HTMLBodyElement;
  const mineFieldBoard = win.document.getElementById(
    'minefield',
  ) as HTMLElement;
  const minefieldBoardWrapper = win.document.getElementById(
    'minefield_board',
  ) as HTMLElement;

  const resetButton = win.document.getElementById('reset') as HTMLElement;
  const resetHeader = win.document.getElementById('header') as HTMLElement;
  const openingConfigElements = Array.from(
    boardMenu.querySelectorAll('[name=initial_click]'),
  ).filter((e): e is HTMLInputElement => e instanceof HTMLInputElement);
  const minesRemainingElements = [1, 2, 3].map(i =>
    win.document.getElementById('mines_remaining_' + i),
  ) as HTMLElement[];

  const timerElements = [1, 2, 3].map(i =>
    win.document.getElementById('timer_' + i),
  ) as HTMLElement[];

  return {
    boardMenu,
    widthElement,
    heightElement,
    mineCountElement,
    bodyElement,
    mineFieldBoard,
    minefieldBoardWrapper,
    resetButton,
    resetHeader,
    openingConfigElements,
    minesRemainingElements,
    timerElements,
  };
}
