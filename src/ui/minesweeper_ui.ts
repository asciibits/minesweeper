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
  encodeElapsedTime,
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
  private readonly bodyElement: HTMLBodyElement;
  private readonly widthElement: HTMLInputElement;
  private readonly heightElement: HTMLInputElement;
  private readonly mineCountElement: HTMLInputElement;
  private readonly expertPreset: HTMLButtonElement;
  private readonly intermediatePreset: HTMLButtonElement;
  private readonly beginnerPreset: HTMLButtonElement;
  private readonly systemColor: HTMLInputElement;
  private readonly lightColor: HTMLInputElement;
  private readonly darkColor: HTMLInputElement;
  private readonly noMineElement: HTMLInputElement;
  private readonly openAreaElement: HTMLInputElement;
  private readonly minePossibleElement: HTMLInputElement;
  private readonly allowUndoElement: HTMLInputElement;
  private readonly singleClickChordElement: HTMLInputElement;
  private readonly allowFlagChordElement: HTMLInputElement;
  private readonly mineFieldBoard: HTMLElement;
  private readonly minefieldBoardWrapper: HTMLElement;
  private readonly resetButton: HTMLElement;
  private readonly resetHeader: HTMLElement;
  private readonly minesRemainingDisplay: DigitalDisplay;
  private readonly timerDisplay: DigitalDisplay;
  private readonly debugElement: HTMLElement;

  // handler state
  private resetMouseDownButtons = 0;
  private cellMouseDownButtons = 0;
  private cellMouseReleasedButtons = 0;
  private cellTouchStart?: Partial<Touch>;
  private previousActiveCell?: HTMLButtonElement;

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
    this.boardIdWorker = this.initBoardIdWorker();

    // initialize the UI elements
    const elements = getDocumentElements(win);
    this.bodyElement = elements.bodyElement;
    this.widthElement = elements.widthElement;
    this.heightElement = elements.heightElement;
    this.mineCountElement = elements.mineCountElement;
    this.expertPreset = elements.expertPreset;
    this.intermediatePreset = elements.intermediatePreset;
    this.beginnerPreset = elements.beginnerPreset;
    this.systemColor = elements.systemColor;
    this.lightColor = elements.lightColor;
    this.darkColor = elements.darkColor;
    this.noMineElement = elements.noMineElement;
    this.openAreaElement = elements.openAreaElement;
    this.minePossibleElement = elements.minePossibleElement;
    this.allowUndoElement = elements.allowUndoElement;
    this.singleClickChordElement = elements.singleClickChordElement;
    this.allowFlagChordElement = elements.allowFlagChordElement;
    this.mineFieldBoard = elements.mineFieldBoard;
    this.minefieldBoardWrapper = elements.minefieldBoardWrapper;
    this.resetButton = elements.resetButton;
    this.resetHeader = elements.resetHeader;
    this.minesRemainingDisplay = new DigitalDisplay(
      elements.minesRemainingElements,
    );
    this.timerDisplay = new DigitalDisplay(elements.timerElements);
    this.debugElement = elements.debugElement;

    // set up the UI listeners

    // Menu related listeners
    const configChangeHandler = (e: Event) => this.handleConfigChangeEvent(e);
    for (const el of [
      this.widthElement,
      this.heightElement,
      this.mineCountElement,
      this.noMineElement,
      this.openAreaElement,
      this.minePossibleElement,
    ]) {
      el.addEventListener('change', configChangeHandler);
    }
    const presetClickHandler = (e: Event) => this.handlePresetClickEvent(e);
    this.expertPreset.addEventListener('click', presetClickHandler);
    this.intermediatePreset.addEventListener('click', presetClickHandler);
    this.beginnerPreset.addEventListener('click', presetClickHandler);
    const colorPaletteChangeHandler = (e: Event) =>
      this.handleColorPaletteEvent(e);
    this.systemColor.addEventListener('change', colorPaletteChangeHandler);
    this.lightColor.addEventListener('change', colorPaletteChangeHandler);
    this.darkColor.addEventListener('change', colorPaletteChangeHandler);
    const playStyleChangeHandler = (e: Event) => this.handlePlayStyleChange(e);
    this.allowUndoElement.addEventListener('change', playStyleChangeHandler);
    this.singleClickChordElement.addEventListener(
      'change',
      playStyleChangeHandler,
    );
    this.allowFlagChordElement.addEventListener(
      'change',
      playStyleChangeHandler,
    );

    // reset related listeners
    this.resetButton.addEventListener('click', () => this.rebuildMineField());
    const resetMouseHandler = (e: MouseEvent) => this.handleResetMouseEvent(e);
    const resetTouchHandler = (e: TouchEvent) => this.handleResetTouchEvent(e);
    this.resetHeader.addEventListener('mousedown', resetMouseHandler);
    this.resetHeader.addEventListener('mouseup', resetMouseHandler);
    this.resetHeader.addEventListener('mouseout', resetMouseHandler);
    this.resetHeader.addEventListener('mouseover', resetMouseHandler);
    this.resetHeader.addEventListener('touchend', resetTouchHandler);

    // read in the current settings, if available
    const settings = JSON.parse(
      win.localStorage?.getItem('settings') ?? 'null',
    ) as ConfigState | null;
    this.setSettings(settings);

    // initialize the tabIndex for the menus
    elements.boardConfigMenu.ensureState();
    elements.settingsMenu.ensureState();

    // perform the initial game build
    this.rebuildMineField(boardId, viewState, elapsedTime);
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
          this.bodyElement.classList.add('complete');
          // this.resetButton.innerText = '😎';
        }, 0);
        break;
      case BoardEventType.UNCOMPLETE:
        this.bodyElement.classList.remove('complete');
        // this.resetButton.innerText = '🤔';
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
          this.bodyElement.classList.add('explode');
          // this.resetButton.innerText = '😵';
        }, 0);
        break;
      case BoardEventType.UNEXPLODE:
        this.bodyElement.classList.remove('explode');
        // this.resetButton.innerText = '🤔';
        this.board.getAllCells().forEach(c => c.setWrong(false));
        break;
      case BoardEventType.TIME_ELAPSED:
        this.updateTimer();
        break;
      case BoardEventType.RESET:
        // this.resetButton.innerText = '😀';
        this.updateMinesRemaining();
        this.updateTimer();
        this.resetBoard();
        this.widthElement.value = String(this.board.getView().width);
        this.heightElement.value = String(this.board.getView().height);
        this.mineCountElement.value = String(this.board.getView().mineCount);
        if (!e.attributes?.['DECODING']) {
          this.bodyElement.classList.remove('in_progress');
          this.bodyElement.classList.remove('explode');
          this.bodyElement.classList.remove('complete');
          this.updateBoardId();
        }
        this.minefieldBoardWrapper.classList.remove('blank');
        break;
      case BoardEventType.FIRST_MOVE:
        // this.resetButton.innerText = '🤔';
        this.bodyElement.classList.add('in_progress');
        break;
      case BoardEventType.CELLS_OPENED:
        this.requestBoardEncode(e.attributes);
        break;
    }
  }

  private handleCellEvent(cell: Cell, event: CellEvent) {
    const elem = getCellElement(cell);
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
        this.cellMouseReleasedButtons = 0;
        if (event.buttons & 1 || event.buttons & 4) {
          // left/middle-click - show cells as 'pressed'
          cell.pressCellOrChord(
            true,
            this.singleClickChordElement.checked || !!(event.buttons & 6),
            !!(event.buttons & 1),
          );
        } else if (event.buttons & 2) {
          // right-click - Either flag if unopened, or chord
          this.processFlag(cell);
        }
        // don't prevent default on mouse-down. This allows the 'click' event
        // to fire, which handles focus properly
        return;
      case 'mouseup':
        const releasedButtons = this.cellMouseDownButtons & ~event.buttons;
        this.cellMouseDownButtons &= event.buttons;
        this.cellMouseReleasedButtons |= releasedButtons;
        cell.pressCellOrChord(false);
        if (this.cellMouseReleasedButtons & 1) {
          this.processClick(
            cell,
            this.singleClickChordElement.checked ||
              !!(this.cellMouseReleasedButtons & 6),
          );
        } else if (this.cellMouseReleasedButtons & 4) {
          // middle click. Chord-only
          this.processClick(cell, true, false);
        }
        break;
      case 'mouseenter':
        this.cellMouseDownButtons &= event.buttons;
        this.cellMouseReleasedButtons = 0;
        // use `buttons` (plural) which has info for enter events
        if (this.cellMouseDownButtons & 1) {
          // If the user clicks the left button and drags it around the board,
          // this keeps the cells under the cursor visually 'pressed'
          cell.pressCellOrChord();
        }
        break;
      case 'mouseleave':
        this.cellMouseReleasedButtons = 0;
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
      this.cellTouchStart = undefined;
      return;
    }
    const touch = touches[0];
    if (
      this.cellTouchStart &&
      touch.identifier !== this.cellTouchStart.identifier
    ) {
      // different touch action - clear the start state
      this.cellTouchStart = undefined;
    }

    switch (event.type) {
      case 'touchstart':
        const {identifier, screenX, screenY} = touch;
        this.cellTouchStart = {
          identifier,
          screenX,
          screenY,
        };
        // allow default actions
        return;
      case 'touchend':
        if (!this.cellTouchStart) {
          // no matching start for this end - nothing to do
          return undefined;
        }
        // get the width of one square
        const cellElement = getCellElement(cell);
        const {width, height} = cellElement?.getBoundingClientRect?.() ?? {
          width: 0,
          height: 0,
        };
        const scale = this.win.visualViewport?.scale ?? 1;
        const dx = Math.abs(
          touch.screenX - (this.cellTouchStart?.screenX ?? 0),
        );
        const dy = Math.abs(
          touch.screenY - (this.cellTouchStart?.screenY ?? 0),
        );
        console.log('Got touch: %o', {
          touch,
          scale,
          touchStart: this.cellTouchStart,
        });
        if (dx <= width * scale && dy <= height * scale) {
          // we have a legit touch!
          if (event.cancelable) {
            event.preventDefault();
          }
          this.processClick(cell);
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
        this.processClick(cell, this.singleClickChordElement.checked);
        break;
      case 'f':
        this.processFlag(cell);
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
      const cell = this.board.getCell(
        (x + width) % width,
        (y + height) % height,
      );
      const cellElement = getCellElement(cell);
      if (this.previousActiveCell) {
        this.previousActiveCell.tabIndex = -1;
      }
      this.previousActiveCell = cellElement;
      cellElement.tabIndex = 0;
      cellElement.focus();
    }
  }

  private handleConfigChangeEvent(e: Event) {
    if (e.defaultPrevented) return;
    if (this.board.isStarted()) {
      // don't make changes to an in-progress game
      return;
    }

    this.highlightActivePreset();
    this.saveState();

    switch (e.target) {
      case this.widthElement:
      case this.heightElement:
      case this.mineCountElement:
      case this.noMineElement:
      case this.openAreaElement:
      case this.minePossibleElement:
        // rebuild when the layout of the game has changed
        this.rebuildMineField();
        break;
    }
    e.preventDefault();
  }

  private handlePresetClickEvent(e: Event) {
    if (e.defaultPrevented) return;
    switch (e.target) {
      case this.expertPreset:
        if (this.updateMenuDimensions(30, 16, 99)) {
          this.widthElement.dispatchEvent(new Event('change'));
        }
        break;
      case this.intermediatePreset:
        if (this.updateMenuDimensions(16, 16, 40)) {
          this.widthElement.dispatchEvent(new Event('change'));
        }
        break;
      case this.beginnerPreset:
        if (this.updateMenuDimensions(9, 9, 10)) {
          this.widthElement.dispatchEvent(new Event('change'));
        }
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  private handleColorPaletteEvent(e: Event) {
    if (e.defaultPrevented) return;
    this.setColorPalette((e.target as HTMLInputElement).value);
    this.saveState();
    e.preventDefault();
  }

  private setColorPalette(palette: string) {
    switch (palette) {
      case 'SYSTEM':
        this.bodyElement.classList.remove('light');
        this.bodyElement.classList.remove('dark');
        this.systemColor.checked = true;
        break;
      case 'LIGHT':
        this.bodyElement.classList.add('light');
        this.bodyElement.classList.remove('dark');
        this.lightColor.checked = true;
        break;
      case 'DARK':
        this.bodyElement.classList.remove('light');
        this.bodyElement.classList.add('dark');
        this.darkColor.checked = true;
        break;
      default:
        return;
    }
  }

  private handlePlayStyleChange(e: Event) {
    if (e.defaultPrevented) return;
    this.saveState();
    e.preventDefault();
  }

  private handleResetMouseEvent(e: MouseEvent) {
    if (e.defaultPrevented) return;
    if (e.target !== this.resetHeader) {
      // ignore events happening on children - relies on css
      // "pointer-events: none" for immediate children, then enabled again on
      // their descendents.
      return;
    }
    if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) {
      return;
    }
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
  }

  private handleResetTouchEvent(e: TouchEvent) {
    if (e.defaultPrevented) return;
    if (e.target !== this.resetHeader) {
      return;
    }
    if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) {
      return;
    }
    const touches = e.touches.length ? e.touches : e.changedTouches;
    if (touches.length !== 1) {
      return;
    }
    switch (e.type) {
      case 'touchend':
        if (e.cancelable) {
          // this event is still up for grabs
          this.resetButton.classList.add('pressed');
          setTimeout(() => {
            this.resetButton.classList.remove('pressed');
            this.resetButton.click();
          }, 0);
          e.preventDefault();
        }
    }
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
        elem.tabIndex = -1;
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
    this.previousActiveCell = this.mineFieldBoard
      .firstElementChild as HTMLButtonElement;
    this.previousActiveCell.tabIndex = 0;
  }

  /** Update the URL parameters for a new board id */
  private updateBoardId(state?: EncodedBoardState) {
    const url = new URL(location.href);
    const initialSearch = url.search;
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
    if (initialSearch === url.search) {
      // nothing to do
      return;
    }
    if (this.allowUndoElement.checked || (initialSearch?.length ?? 0) <= 1) {
      this.win.history.pushState({}, '', url);
    } else {
      this.win.history.replaceState({}, '', url);
    }
  }

  private updateElapsedTime() {
    const encoded = encodeElapsedTime(this.board.getTimeElapsed());
    const url = new URL(location.href);
    if (encoded) {
      url.searchParams.set('elapsed_time', encoded);
    } else {
      url.searchParams.delete('elapsed_time');
    }
    console.log('updating history');
    this.win.history.replaceState({}, '', url);
  }

  /** Rebuild the Mine Field */
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
      const {width, height, mines, initialClick} = this.getBoardConfig();
      // use a mine field that delays creation until the initial click
      this.board.reset(
        new DelayedMineField(width, height, mines, initialClick),
      );
    }
  }

  private getBoardConfig() {
    let {width, height, mineCount, initialClick} = this.getSettings();

    if (!width || isNaN(width) || width < 1) {
      width = 1;
    }
    if (!height || isNaN(height) || height < 1) {
      height = 1;
    }
    const cellCount = width * height;
    if (!mineCount || isNaN(mineCount) || mineCount < 1) {
      mineCount = 0;
    } else if (mineCount > cellCount) {
      mineCount = cellCount;
    }
    if (mineCount === cellCount) {
      // No room for a non-mine opening
      initialClick = OpeningRestrictions.ANY;
    } else if (mineCount > cellCount - 9) {
      if (initialClick === OpeningRestrictions.ZERO) {
        // no room for a zero opening
        initialClick = OpeningRestrictions.ANY;
      }
    }
    return {width, height, mines: mineCount, initialClick};
  }

  private updateMenuDimensions(
    width: number,
    height: number,
    mineCount: number,
  ): boolean {
    let changed = false;
    if (this.widthElement.valueAsNumber !== width) {
      changed = true;
      this.widthElement.valueAsNumber = width;
    }
    if (this.heightElement.valueAsNumber !== height) {
      changed = true;
      this.heightElement.valueAsNumber = height;
    }
    if (this.mineCountElement.valueAsNumber !== mineCount) {
      changed = true;
      this.mineCountElement.valueAsNumber = mineCount;
    }
    this.highlightActivePreset();
    return changed;
  }

  private highlightActivePreset() {
    const {width, height, mines} = this.getBoardConfig();
    let activeButton: HTMLElement | undefined = undefined;
    if (height === 16 && width === 30 && mines === 99) {
      activeButton = this.expertPreset;
    } else if (height === 16 && width === 16 && mines === 40) {
      activeButton = this.intermediatePreset;
    } else if (height === 9 && width === 9 && mines === 10) {
      activeButton = this.beginnerPreset;
    }
    [this.expertPreset, this.intermediatePreset, this.beginnerPreset].forEach(
      e => {
        e.classList.toggle('active', activeButton === e);
      },
    );
  }

  /** Get the current state of the menu options */
  private getSettings(): ConfigState {
    const colorPalette = this.darkColor.checked
      ? 'DARK'
      : this.lightColor.checked
        ? 'LIGHT'
        : 'SYSTEM';
    const width = this.widthElement.valueAsNumber;
    const height = this.heightElement.valueAsNumber;
    const mineCount = this.mineCountElement.valueAsNumber;
    const initialClick = this.openAreaElement.checked
      ? OpeningRestrictions.ZERO
      : this.minePossibleElement.checked
        ? OpeningRestrictions.ANY
        : OpeningRestrictions.NO_MINE;
    const allowUndo = this.allowUndoElement.checked;
    const singleClickChord = this.singleClickChordElement.checked;
    const allowFlagChord = this.allowFlagChordElement.checked;
    return {
      colorPalette,
      width,
      height,
      mineCount,
      initialClick,
      allowUndo,
      singleClickChord,
      allowFlagChord,
    };
  }

  private setSettings(configState?: ConfigState | null) {
    this.setColorPalette(configState?.colorPalette ?? 'SYSTEM');
    switch (configState?.initialClick) {
      case OpeningRestrictions.ZERO:
        this.openAreaElement.checked = true;
        break;
      case OpeningRestrictions.ANY:
        this.minePossibleElement.checked = true;
        break;
      default: // 'NO_MINE'
        this.noMineElement.checked = true;
        break;
    }
    this.updateMenuDimensions(
      configState?.width ?? 30,
      configState?.height ?? 16,
      configState?.mineCount ?? 99,
    );
    this.allowUndoElement.checked = configState?.allowUndo ?? false;
    this.singleClickChordElement.checked =
      configState?.singleClickChord ?? false;
    this.allowFlagChordElement.checked = configState?.allowFlagChord ?? false;
  }

  private saveState() {
    const settings = JSON.stringify(this.getSettings());
    if (this.win.localStorage) {
      this.win.localStorage.setItem('settings', settings);
    }
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

  /** Handle an asyncronous 'encode board id' response */
  handleEncodeResponse(encodedBoardState: EncodedBoardState) {
    this.updateBoardId(encodedBoardState);
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
    if (this.timerDisplay.setValue(this.board.getTimeElapsed() / 1000)) {
      this.updateElapsedTime();
    }
  }

  private processClick(cell: Cell, allowChord = false, allowOpen = true) {
    if (this.previousActiveCell) {
      this.previousActiveCell.tabIndex = -1;
    }
    this.previousActiveCell = getCellElement(cell);
    this.previousActiveCell.tabIndex = 0;
    if (cell.isOpened() && allowChord) {
      cell.chord();
    } else if (!cell.isFlagged() && allowOpen) {
      cell.open();
    }
  }

  private processFlag(cell: Cell) {
    if (this.previousActiveCell) {
      this.previousActiveCell.tabIndex = -1;
    }
    this.previousActiveCell = getCellElement(cell);
    this.previousActiveCell.tabIndex = 0;
    if (cell.isOpened() && this.allowFlagChordElement.checked) {
      cell.chord();
    } else {
      cell.flag(!cell.isFlagged());
    }
  }

  private initBoardIdWorker() {
    const boardIdWorker = new BoardIdWorker();

    this.win.addEventListener('popstate', () => {
      const url = new URL(location.href);
      const boardId = url.searchParams.get('board_id');
      const viewState = url.searchParams.get('view_state') ?? undefined;
      const elapsedTime = url.searchParams.get('elapsed_time') ?? undefined;
      if (boardId) {
        boardIdWorker.requestDecode({boardId, viewState, elapsedTime});
      } else {
        if (this.allowUndoElement.checked) {
          // close all cells
          this.board.getAllCells().forEach(c => {
            c.close();
            c.flag(false);
          });
        } else {
          this.rebuildMineField();
        }
      }
    });

    boardIdWorker.addDecodeToBoardListener(this.board);
    boardIdWorker.addEncodeListener(this);
    return boardIdWorker;
  }

  private logError(e: unknown) {
    console.log(e);
    this.debugElement.innerHTML += JSON.stringify(e) + '\n';
  }
}

function hide(menu: HTMLElement) {
  menu.classList.remove('active');
}

function show(menu: HTMLElement) {
  menu.classList.add('active');
  if (document.activeElement === menu.querySelector('.menu_pulldown')) {
    (menu.querySelector('[tabindex="0"]') as HTMLElement)?.focus();
  }
}

function isVisible(element: HTMLElement) {
  return element.classList.contains('active');
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

function getCellElement(cell: Cell): HTMLButtonElement {
  return cell.getAttribute('element') as HTMLButtonElement;
}

interface ConfigState {
  colorPalette?: 'SYSTEM' | 'LIGHT' | 'DARK';
  width?: number;
  height?: number;
  mineCount?: number;
  initialClick?: OpeningRestrictions;
  allowUndo?: boolean;
  singleClickChord?: boolean;
  allowFlagChord?: boolean;
}

class DigitalDisplay {
  constructor(private readonly cells: HTMLElement[]) {}

  setValue(val: number | string): boolean {
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
    let changed = false;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].innerText !== val[i]) {
        changed = true;
        this.cells[i].innerText = val[i];
      }
    }
    return changed;
  }
}

function isActive(el: HTMLElement) {
  return el.classList.contains('active') || (el as HTMLInputElement).checked;
}
function getActiveIndex(group: HTMLElement[]): number {
  return group.findIndex(isActive);
}

class Menu {
  constructor(
    private readonly menu: HTMLElement,
    private readonly menuButton: HTMLButtonElement,
    private readonly menuGroups: HTMLElement[][],
  ) {
    this.menu.addEventListener('keydown', e => this.handleKeyEvent(e));
    this.menu.addEventListener('focusin', e => this.handleFocusEvent(e));
    this.menu.addEventListener('focusout', e => this.handleFocusEvent(e));
    this.menuButton.addEventListener('pointerdown', e =>
      this.handleToggleEvent(e),
    );
    const win = this.menu.getRootNode() as HTMLElement;
    win.addEventListener('pointerdown', e => this.handleCloseEvent(e));
    win.addEventListener('keydown', e => this.handleCloseEvent(e));
    win.addEventListener('focusin', e => this.handleCloseEvent(e));
  }

  private getGroupIndex(el: HTMLElement) {
    return this.menuGroups
      .map((g, i) => [i, g.indexOf(el)])
      .find(r => r[1] >= 0) as [number, number];
  }

  private handleKeyEvent(e: KeyboardEvent) {
    if (e.defaultPrevented) return;
    if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;

    const el = e.target as HTMLElement;
    const currentIdx = this.getGroupIndex(el);
    const group = this.menuGroups[currentIdx[0]];

    const moveFocus = (dx: number, dy: number) => {
      const group =
        this.menuGroups[
          ((currentIdx?.[0] ?? -1) + dy + this.menuGroups.length) %
            this.menuGroups.length
        ];
      const groupActiveIdx = dy === 0 ? currentIdx[1] : getActiveIndex(group);

      const activeElement =
        group[(groupActiveIdx + dx + group.length) % group.length];
      activeElement.focus();
      this.ensureState();
    };

    switch (e.code) {
      case 'Escape':
        hide(this.menu);
        break;
      case 'ArrowDown':
        moveFocus(0, 1);
        break;
      case 'ArrowUp':
        moveFocus(0, -1);
        break;
      case 'ArrowLeft':
        if (group.length > 1) {
          moveFocus(-1, 0);
        } else {
          // let component handle it
          return;
        }
        break;
      case 'ArrowRight':
        if (group.length > 1) {
          moveFocus(1, 0);
        } else {
          // let component handle it
          return;
        }
        break;
      default:
        return;
    }
    e.preventDefault();
  }
  private handleFocusEvent(e: FocusEvent) {
    if (e.defaultPrevented) return;
    switch (e.type) {
      case 'focusin':
        show(this.menu);
        this.ensureState();
        break;
      case 'focusout':
        this.ensureState();
        break;
    }
  }

  ensureState() {
    if (
      this.menu.contains(document.activeElement) &&
      document.activeElement !== this.menuButton
    ) {
      this.menuGroups.flatMap(g => g).forEach(e => (e.tabIndex = -1));
      (document.activeElement as HTMLElement).tabIndex = 0;
      return;
    }

    // make sure 1, and only 1 element has a tabIndex set
    let group: HTMLElement[] | undefined = undefined;
    let item: HTMLElement | undefined = undefined;

    for (const menuGroup of this.menuGroups) {
      for (const menuItem of menuGroup) {
        if (menuItem.tabIndex === 0) {
          if (group) {
            console.warn('found multiple tabbable elements. Using first');
            menuItem.tabIndex = -1;
          } else {
            group = menuGroup;
            item = menuItem;
          }
        }
      }
    }
    if (!group || !item) {
      // this is expected when first loading the page
      group = this.menuGroups[0];
      item = group[0];
      item.tabIndex = 0;
    }

    if (document.activeElement === this.menuButton) {
      item.focus();
    } else {
      // focus leaving menu - update the tabbable element to be the group's
      // current active. This is required for radio buttons (chrome only tabs to
      // checked radio buttons) but for consistency, we'll apply this to all
      // groups
      if (group.length > 1) {
        const activeElement = group.find(isActive);
        if (activeElement) {
          if (activeElement !== item) {
            item.tabIndex = -1;
            activeElement.tabIndex = 0;
          }
        } else {
          // if item is a radio button, mark it checked
          if ((item as HTMLInputElement).type === 'radio') {
            (item as HTMLInputElement).checked = true;
          }
        }
      }
    }
  }

  private handleCloseEvent(e: Event) {
    if (e.defaultPrevented) return;
    if (
      !this.menu.contains(e.target as Node) &&
      e.target !== this.menuButton &&
      isVisible(this.menu)
    ) {
      hide(this.menu);
    }
  }

  private handleToggleEvent(e: PointerEvent) {
    if (e.defaultPrevented) return;
    if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;

    if (isVisible(this.menu)) {
      hide(this.menu);
    } else {
      show(this.menu);
    }
    if (e.cancelable) {
      e.preventDefault();
    }
  }
}

function getDocumentElements(win: Window) {
  const bodyElement = win.document.getElementsByTagName(
    'body',
  )[0] as HTMLBodyElement;
  const boardMenu = win.document.getElementById('board_menu') as HTMLElement;
  const boardMenuPulldown = win.document.getElementById(
    'board_menu_pulldown',
  ) as HTMLButtonElement;
  const settingsMenuElement = win.document.getElementById(
    'settings_menu',
  ) as HTMLElement;
  const settingsMenuPulldown = win.document.getElementById(
    'settings_menu_pulldown',
  ) as HTMLButtonElement;

  const widthElement = win.document.getElementById('width') as HTMLInputElement;
  const heightElement = win.document.getElementById(
    'height',
  ) as HTMLInputElement;
  const mineCountElement = win.document.getElementById(
    'mines',
  ) as HTMLInputElement;
  const expertPreset = window.document.getElementById(
    'expert_preset',
  ) as HTMLButtonElement;
  const intermediatePreset = window.document.getElementById(
    'intermediate_preset',
  ) as HTMLButtonElement;
  const beginnerPreset = window.document.getElementById(
    'beginner_preset',
  ) as HTMLButtonElement;
  const systemColor = window.document.getElementById(
    'system_color',
  ) as HTMLInputElement;
  const lightColor = window.document.getElementById(
    'light_color',
  ) as HTMLInputElement;
  const darkColor = window.document.getElementById(
    'dark_color',
  ) as HTMLInputElement;
  const noMineElement = window.document.getElementById(
    'no_mine',
  ) as HTMLInputElement;
  const openAreaElement = window.document.getElementById(
    'open_area',
  ) as HTMLInputElement;
  const minePossibleElement = window.document.getElementById(
    'mine_possible',
  ) as HTMLInputElement;
  const allowUndoElement = window.document.getElementById(
    'allow_undo',
  ) as HTMLInputElement;
  const singleClickChordElement = window.document.getElementById(
    'single_click_chord',
  ) as HTMLInputElement;
  const allowFlagChordElement = window.document.getElementById(
    'allow_flag_chord',
  ) as HTMLInputElement;

  const mineFieldBoard = win.document.getElementById(
    'minefield',
  ) as HTMLElement;
  const minefieldBoardWrapper = win.document.getElementById(
    'minefield_board',
  ) as HTMLElement;

  const resetButton = win.document.getElementById('reset') as HTMLElement;
  const resetHeader = win.document.getElementById('header') as HTMLElement;
  const minesRemainingElements = [1, 2, 3].map(i =>
    win.document.getElementById('mines_remaining_' + i),
  ) as HTMLElement[];

  const timerElements = [1, 2, 3].map(i =>
    win.document.getElementById('timer_' + i),
  ) as HTMLElement[];
  const debugElement = win.document.getElementById(
    'debug_element',
  ) as HTMLElement;

  const boardConfigMenu = new Menu(boardMenu, boardMenuPulldown, [
    [expertPreset, intermediatePreset, beginnerPreset],
    [widthElement],
    [heightElement],
    [mineCountElement],
  ]);

  const settingsMenu = new Menu(settingsMenuElement, settingsMenuPulldown, [
    [systemColor, lightColor, darkColor],
    [noMineElement, openAreaElement, minePossibleElement],
    [allowUndoElement],
    [singleClickChordElement],
    [allowFlagChordElement],
  ]);

  return {
    bodyElement,
    boardConfigMenu,
    settingsMenu,
    widthElement,
    heightElement,
    mineCountElement,
    expertPreset,
    intermediatePreset,
    beginnerPreset,
    systemColor,
    lightColor,
    darkColor,
    noMineElement,
    openAreaElement,
    minePossibleElement,
    allowUndoElement,
    singleClickChordElement,
    allowFlagChordElement,
    mineFieldBoard,
    minefieldBoardWrapper,
    resetButton,
    resetHeader,
    minesRemainingElements,
    timerElements,
    debugElement,
  };
}
