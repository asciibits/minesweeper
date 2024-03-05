import {BitSet} from '../util/io.js';
import {error, info, trace} from '../util/logging.js';
import {assert} from '../util/assert.js';
import {CellVisibleState, MineBoard, MineFieldView} from './minesweeper.js';
import {
  EncodedBoardState,
  KnownBoardState,
  OpenState,
  applyBoardState,
  assertBoardState,
  assertEncodedBoardState,
} from './minesweeper_storage.js';

export interface BitSetInfo {
  buffer: number[];
  bitCount: number;
}

export interface DecodeMessageRequest {
  messageType: 'DECODE';
  encodedBoardState: EncodedBoardState;
}

export interface DecodeMessageResponse {
  messageType: 'DECODE';
  boardState: KnownBoardState;
}

export interface EncodeMessageRequest {
  messageType: 'ENCODE';
  boardState: KnownBoardState;
}

export interface EncodeMessageResponse {
  messageType: 'ENCODE';
  encodedBoardState: EncodedBoardState;
}

export type MessageRequest = DecodeMessageRequest | EncodeMessageRequest;
export type MessageResponse = DecodeMessageResponse | EncodeMessageResponse;

export interface EncodeBoardIdListener {
  handleEncodeResponse(encodedBoardState: EncodedBoardState): void;
}
export interface DecodeBoardIdListener {
  handleDecodeResponse(boardState: KnownBoardState): void;
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
    // deveoper mode - pull in the library directly
    this.worker = new Worker('../lib/ui/board_id_worker_entry.js', {
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
          const {boardState: boardInfo} = messageResponse;
          assertBoardState(boardInfo);
          this.decodeListeners.forEach(l => l.handleDecodeResponse(boardInfo));
          break;
        case 'ENCODE':
          const {encodedBoardState} = messageResponse;
          assertEncodedBoardState(encodedBoardState);
          this.encodeListeners.forEach(l =>
            l.handleEncodeResponse(encodedBoardState),
          );
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
      boardState: boardInfo,
    } as EncodeMessageRequest);
  }

  requestDecode(encodedBoardState: EncodedBoardState) {
    assert(!this.terminated, 'BoardIdWorker has been terminated');
    trace(
      '[BoardIdWorker.requestDecode] Sending decode request: %o',
      encodedBoardState,
    );
    this.worker.postMessage({
      messageType: 'DECODE',
      encodedBoardState,
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
      handleDecodeResponse: (boardState: KnownBoardState) => {
        applyBoardState(board, boardState, {DECODING: true});
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

function getBoardInfo(board: MineBoard): KnownBoardState {
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
