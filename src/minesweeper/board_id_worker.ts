import {BitSet} from '../util/io.js';
import {error, info, trace} from '../util/logging.js';
import {assert} from '../util/assert.js';
import {
  BoardEventType,
  Cell,
  CellVisibleState,
  MineBoard,
  MineField,
  MineFieldView,
  mineFieldsEqual,
} from './minesweeper.js';
import {
  KnownBoardInfo,
  OpenState,
  assertBoardInfo,
} from './minesweeper_storage.js';

export interface BitSetInfo {
  buffer: number[];
  bitCount: number;
}

export interface DecodeMessageRequest {
  messageType: 'DECODE';
  boardId: string;
}

export interface DecodeMessageResponse {
  messageType: 'DECODE';
  boardInfo: KnownBoardInfo;
}

export interface EncodeMessageRequest {
  messageType: 'ENCODE';
  boardInfo: KnownBoardInfo;
}

export interface EncodeMessageResponse {
  messageType: 'ENCODE';
  boardId: string;
}

export type MessageRequest = DecodeMessageRequest | EncodeMessageRequest;
export type MessageResponse = DecodeMessageResponse | EncodeMessageResponse;

export interface EncodeBoardIdListener {
  handleEncodeResponse(boardId: string): void;
}
export interface DecodeBoardIdListener {
  handleDecodeResponse(boardInfo: KnownBoardInfo): void;
}
export class BoardIdWorker {
  private readonly worker: Worker;
  private readonly encodeListeners = new Set<EncodeBoardIdListener>();
  private readonly decodeListeners = new Set<DecodeBoardIdListener>();
  private readonly boardListeners = new Map<MineBoard, DecodeBoardIdListener>();
  private terminated = false;

  /**
   * The last view decoded. This offers a simple cache for multiple calls to
   * requestEncode with the same view, but different exposed
   */
  private lastEncoded?: {
    view: MineFieldView;
    rawBoardId: BitSet;
    boardId: string;
  };

  constructor() {
    info('[BoardIdWorker] Starting Board ID worker');
    let url: string;
    if (
      !inlinedWorkerCode.startsWith('<<') &&
      !inlinedWorkerCode.endsWith('>>')
    ) {
      // dist mode - use the inlined worker code directly
      const blob = new Blob([inlinedWorkerCode], {type: 'text/javascript'});
      url = URL.createObjectURL(blob);
    } else {
      // deveoper mode - pull in the library directly
      url = '../lib/ui/board_id_worker_entry.js';
    }
    this.worker = new Worker(url, {
      type: 'module',
      name: 'BoardIdWorker',
    });
    this.worker.onerror = (e: ErrorEvent) => {
      error(
        '[BoardIdWorker.worker.onerror] Got error. Message: %o\nError: %o\n' +
          'filename: % o\nlineno: % o\nevent: % o',
        e.message,
        e.error,
        e.filename,
        e.lineno,
        e,
      );
    };
    this.worker.onmessageerror = (e: MessageEvent) => {
      error(
        '[BoardIdWorker.worker.onerror] Got error. Data: %oevent: %o',
        e.data,
        e,
      );
    };
    this.worker.onmessage = (e: MessageEvent) => {
      trace(
        '[BoardIdWorker.worker.onmessage] Message to worker received: %o',
        e,
      );
      const messageResponse = e.data as Partial<MessageResponse>;
      switch (messageResponse.messageType) {
        case 'DECODE':
          const {boardInfo} = messageResponse;
          assertBoardInfo(boardInfo);
          this.decodeListeners.forEach(l => l.handleDecodeResponse(boardInfo));
          break;
        case 'ENCODE':
          const {boardId} = messageResponse;
          assert(
            typeof boardId === 'string',
            'Invalid board id: ' + JSON.stringify(boardId),
          );
          this.encodeListeners.forEach(l => l.handleEncodeResponse(boardId!));
          break;
        default:
          throw new Error(
            'Unrecognized message response type: ' +
              JSON.stringify(messageResponse),
          );
      }
    };
    info('[BoardIdWorker] Board ID worker initialized');
  }

  requestEncode(board: MineBoard) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    const view = board.getView();
    if (this.lastEncoded?.view === view) {
      for (const listener of this.encodeListeners) {
        listener.handleEncodeResponse;
      }
    }
    const boardInfo = getBoardInfo(board);
    trace(
      '[BoardIdWorker.requestEncode] Sending encode request: %o',
      boardInfo,
    );
    this.worker.postMessage({
      messageType: 'ENCODE',
      boardInfo,
    } as EncodeMessageRequest);
  }

  requestDecode(boardId: string) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.requestDecode] Sending decode request: %o', boardId);
    this.worker.postMessage({
      messageType: 'DECODE',
      boardId,
    } as DecodeMessageRequest);
  }

  addEncodeListener(listener: EncodeBoardIdListener) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.addEncodeListener]');
    this.encodeListeners.add(listener);
  }

  removeEncodeListener(listener: EncodeBoardIdListener) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.removeEncodeListener]');
    this.encodeListeners.delete(listener);
  }

  addDecodeListener(listener: DecodeBoardIdListener) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.addDecodeListener]');
    this.decodeListeners.add(listener);
  }

  removeDecodeListener(listener: DecodeBoardIdListener) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.removeDecodeListener]');
    this.decodeListeners.delete(listener);
  }

  /**
   * Add a decode listener that updates a given `MineBoard`. All events will
   * have the attribute: 'DECODING; set to 'true;
   *
   * @param board The board to receive all decoded info.
   */
  addDecodeToBoardListener(board: MineBoard) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.addDecodeToBoardListener]');
    const listener: DecodeBoardIdListener = {
      handleDecodeResponse: (boardInfo: KnownBoardInfo) => {
        const mineField = getMineField(boardInfo);
        // only reset the board if we have a new minefield. This optimization
        // prevents building up the entire board when only a part of it is
        // changing
        const needsReset = !mineFieldsEqual(mineField, board.getView());
        if (needsReset) {
          board.reset(mineField, {DECODING: true});
        }
        const openMines = new Set<Cell>();
        for (let i = 0; i < boardInfo.cellData.length; i++) {
          const cell = board.getCell(i);
          cell.setWrong(false, {DECODING: true});
          switch (boardInfo.cellData[i].openState) {
            case OpenState.OPENED:
              if (cell.isMine()) {
                openMines.add(cell);
              } else {
                cell.openNoExpand({DECODING: true});
              }
              break;
            case OpenState.FLAGGED:
              cell.close({DECODING: true});
              cell.flag(true, {DECODING: true});
              break;
            default:
              cell.close({DECODING: true});
              cell.flag(false, {DECODING: true});
              break;
          }
        }
        // open mines after the rest of the board is build (allows the UI to
        // have everything else properly rendered before showing the bomb
        // status)
        board.openGroup(openMines, {DECODING: true});
        if (needsReset) {
          board.setTimeElapsed(boardInfo.elapsedTime, {DECODING: true});
        }
        // force a TIME event for completed game
        if (board.isComplete() || board.isExploded()) {
          board.fireEvent(BoardEventType.TIME_ELAPSED, {DECODING: true});
        }
      },
    };
    this.removeDecodeToBoardListener(board);
    this.boardListeners.set(board, listener);
    this.addDecodeListener(listener);
  }

  removeDecodeToBoardListener(board: MineBoard) {
    const listener = this.boardListeners.get(board);
    if (listener) {
      this.removeDecodeListener(listener);
      this.boardListeners.delete(board);
    }
  }

  terminate() {
    this.terminated = true;
    this.encodeListeners.clear();
    this.decodeListeners.clear();
    this.boardListeners.clear();
    this.worker.terminate();
  }
}

function getMineField(boardInfo: KnownBoardInfo) {
  const {width, height, cellData} = boardInfo;
  return MineField.createMineFieldWithMineMap(
    width,
    height,
    cellData.map(c => c.isMine),
  );
}

function getBoardInfo(board: MineBoard): KnownBoardInfo {
  const elapsedTime = board.getTimeElapsed();
  const view = board.getView();
  const {width, height} = view;
  const cellData = board.getAllCells().map(c => ({
    isMine:
      view.getCellValue(c.position.x, c.position.y) === CellVisibleState.MINE,
    openState: c.isOpened()
      ? OpenState.OPENED
      : c.isFlagged()
        ? OpenState.FLAGGED
        : OpenState.CLOSED,
  }));

  return {width, height, elapsedTime, cellData};
}

/** This is populated when creating the 'dist' */
const inlinedWorkerCode = '<<BOARD_ID_WORKER_ENTRY>>';
