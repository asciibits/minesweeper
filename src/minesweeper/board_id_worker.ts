import { decodeBase64, encodeBase64 } from '../util/base64.js';
import { BitSet, BitSetWriter } from '../util/io.js';
import { error, info, trace } from '../util/logging.js';
import { assert } from '../util/assert.js';
import {
  Cell,
  CellVisibleState,
  MineBoard,
  MineField,
  MineFieldView,
  mineFieldsEqual,
} from './minesweeper.js';
import {
  KnownBoardInfo,
  MineBoardCoder,
  OpenState,
  assertBoardInfo,
} from './minesweeper_storage.js';
import { Stats } from './stats.js';
import {
  decodeValue,
  encodeValueToBitSet,
} from '../util/compression/arithmetic.js';

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

export interface StatsMessageRequest {
  messageType: 'STATS';
  boardInfo: KnownBoardInfo;
}

export interface StatsMessageResponse {
  messageType: 'STATS';
  stats: Stats;
}

export type MessageRequest =
  | DecodeMessageRequest
  | EncodeMessageRequest
  | StatsMessageRequest;
export type MessageResponse =
  | DecodeMessageResponse
  | EncodeMessageResponse
  | StatsMessageResponse;

export interface EncodeBoardIdListener {
  handleEncodeResponse(boardId: string): void;
}
export interface DecodeBoardIdListener {
  handleDecodeResponse(boardInfo: KnownBoardInfo): void;
}
export interface StatsListener {
  handleStatsResponse(stats: Stats): void;
}

export class BoardIdWorker {
  private readonly worker: Worker;
  private readonly encodeListeners = new Set<EncodeBoardIdListener>();
  private readonly decodeListeners = new Set<DecodeBoardIdListener>();
  private readonly statsListeners = new Set<StatsListener>();
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

  constructor(pathToWorker = '../lib/minesweeper/') {
    info('[BoardIdWorker] Starting Board ID worker');
    // this.worker = new Worker(pathToWorker + 'board_id_worker.js', {
    this.worker = new Worker(pathToWorker + 'board_id_worker.js', {
      type: 'module',
      name: 'BoardIdWorker',
    });
    this.worker.onerror = (e: ErrorEvent) => {
      error(
        '[BoardIdWorker.worker.onerror] Got error. Message: %o\nError: %o\nfilename: %o\nlineno: %o\nevent: %o',
        e.message,
        e.error,
        e.filename,
        e.lineno,
        e
      );
    };
    this.worker.onmessageerror = (e: MessageEvent) => {
      error(
        '[BoardIdWorker.worker.onerror] Got error. Data: %oevent: %o',
        e.data,
        e
      );
    };
    this.worker.onmessage = (e: MessageEvent) => {
      trace(
        '[BoardIdWorker.worker.onmessage] Message to worker received: %o',
        e
      );
      const messageResponse = e.data as Partial<MessageResponse>;
      switch (messageResponse.messageType) {
        case 'DECODE':
          const { boardInfo } = messageResponse;
          assertBoardInfo(boardInfo);
          this.decodeListeners.forEach(l => l.handleDecodeResponse(boardInfo));
          break;
        case 'ENCODE':
          const { boardId } = messageResponse;
          assert(
            typeof boardId === 'string',
            'Invalid board id: ' + JSON.stringify(boardId)
          );
          this.encodeListeners.forEach(l => l.handleEncodeResponse(boardId!));
          break;
        case 'STATS':
          let { stats } = messageResponse;
          assert(stats, 'Stats not found in response');
          this.statsListeners.forEach(l => l.handleStatsResponse(stats!));
          break;
        default:
          throw new Error(
            'Unrecognized message response type: ' +
              JSON.stringify(messageResponse)
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
      boardInfo
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

  requestStats(board: MineBoard) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    const start = Date.now();
    const boardInfo = getBoardInfo(board);
    const mid = Date.now();
    trace('[BoardIdWorker.requestStats] Sending encode request: %o', boardInfo);
    const mid2 = Date.now();
    this.worker.postMessage({
      messageType: 'STATS',
      boardInfo,
    } as StatsMessageRequest);
    const end = Date.now();
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
          board.reset(mineField, { DECODING: true });
        }
        const openMines = new Set<Cell>();
        for (let i = 0; i < boardInfo.cellData.length; i++) {
          const cell = board.getCell(i);
          cell.setWrong(false);
          switch (boardInfo.cellData[i].openState) {
            case OpenState.OPENED:
              if (cell.isMine()) {
                openMines.add(cell);
              } else {
                cell.openNoExpand();
              }
              break;
            case OpenState.FLAGGED:
              cell.close();
              cell.flag();
              break;
            default:
              cell.close();
              cell.flag(false);
              break;
          }
        }
        // open mines after the rest of the board is build (allows the UI to
        // have everything else properly rendered before showing the bomb
        // status)
        console.log('showing mines: %o', openMines.size);
        board.openGroup(openMines, { DECODING: true });
        if (needsReset) {
          board.setTimeElapsed(boardInfo.elapsedTime);
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

  addStatsListener(listener: StatsListener) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.addStatsListener]');
    this.statsListeners.add(listener);
  }

  removeStatsListener(listener: StatsListener) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace('[BoardIdWorker.removeStatsListener]');
    this.statsListeners.delete(listener);
  }

  terminate() {
    this.terminated = true;
    this.encodeListeners.clear();
    this.decodeListeners.clear();
    this.statsListeners.clear();
    this.boardListeners.clear();
    this.worker.terminate();
  }
}

function getMineField(boardInfo: KnownBoardInfo) {
  const { width, height, cellData } = boardInfo;
  return MineField.createMineFieldWithMineMap(
    width,
    height,
    cellData.map(c => c.isMine)
  );
}

function getBoardInfo(board: MineBoard): KnownBoardInfo {
  const elapsedTime = board.getTimeElapsed();
  const view = board.getView();
  const { width, height } = view;
  const cellData = board.getAllCells().map(c => ({
    isMine:
      view.getCellValue(c.position.x, c.position.y) === CellVisibleState.MINE,
    openState: c.isOpened()
      ? OpenState.OPENED
      : c.isFlagged()
        ? OpenState.FLAGGED
        : OpenState.CLOSED,
  }));

  return { width, height, elapsedTime, cellData };
}

/**
 * window is undefined when this is loaded as a worker module, and onmessage is
 * undefined when loaded as a node test
 */
if (typeof window === 'undefined' && typeof onmessage !== 'undefined') {
  /** Set up the board message handling */
  const boardCoder = new MineBoardCoder();

  // setLoggingLevel(LoggingLevel.TRACE);
  onmessage = (e: MessageEvent) => {
    trace('Processing web worker event: %o', e);
    const message = e.data as Partial<MessageRequest>;
    switch (message.messageType) {
      case 'ENCODE': {
        let { boardInfo } = message;
        assertBoardInfo(boardInfo);
        const boardId = encodeBase64(
          encodeValueToBitSet(boardInfo, boardCoder).toReader()
        );
        postMessage({
          messageType: 'ENCODE',
          boardId,
        });
        break;
      }
      case 'DECODE': {
        const { boardId } = message;
        assert(
          typeof boardId === 'string',
          'Invalid board id: ' + JSON.stringify(boardId)
        );
        const writer = new BitSetWriter();
        decodeBase64(boardId!, writer);
        const boardInfo = decodeValue(writer.bitset.toReader(), boardCoder);
        postMessage({
          messageType: 'DECODE',
          boardInfo,
        } as DecodeMessageResponse);
        break;
      }
      case 'STATS': {
        const { boardInfo } = message;
        assertBoardInfo(boardInfo);
        postMessage({
          messageType: 'STATS',
          stats: {}, // getStats(boardInfo),
        } as StatsMessageResponse);
        break;
      }
      default:
        throw new Error('Unknown message type: ' + message.messageType);
    }
  };
}
