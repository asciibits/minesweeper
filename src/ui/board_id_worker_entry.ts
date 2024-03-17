import {trace} from '../util/logging.js';
import {
  DecodeMessageResponse,
  MessageRequest,
} from '../minesweeper/board_id_worker.js';
import {
  EncodedBoardState,
  KnownBoardState,
  KnownCell,
  assertBoardState,
  assertEncodedBoardState,
  decodeBoardState,
  encodeBoardId,
  encodeElapsedTime,
  encodeViewState,
} from '../minesweeper/minesweeper_storage.js';

class CachedDecoder {
  // The decoded board state
  private width?: number;
  private height?: number;
  private cellData?: KnownCell[];
  private cachedElapsedTime?: number;

  // The encoded board state
  private boardId?: string;
  private viewState?: string;
  private elapsedTime?: string;

  constructor() {}

  encodeBoardState(boardState: KnownBoardState): EncodedBoardState {
    const {width, height, cellData, elapsedTime: knownElapsedTime} = boardState;
    let minesMatch = false;
    let cellsMatch = false;
    if (width === this.width && height === this.height) {
      minesMatch = true;
      cellsMatch = true;
      const cachedCellData = this.cellData ?? [];
      for (let i = 0; i < cellData.length; i++) {
        if (cellData[i] !== cachedCellData[i]) {
          cellsMatch = false;
          if (cellData[i].isMine !== cachedCellData[i]?.isMine) {
            minesMatch = false;
            break;
          }
        }
      }
    }
    const boardId = minesMatch ? this.boardId! : encodeBoardId(boardState);
    const viewState = cellsMatch ? this.viewState : encodeViewState(boardState);
    const elapsedTime =
      knownElapsedTime === this.cachedElapsedTime
        ? this.elapsedTime
        : encodeElapsedTime(knownElapsedTime);

    this.width = width;
    this.height = height;
    this.cellData = cellData;
    this.cachedElapsedTime = knownElapsedTime;
    this.boardId = boardId;
    this.viewState = viewState;
    this.elapsedTime = elapsedTime;

    return {boardId, viewState, elapsedTime};
  }
}

/**
 * window is undefined when this is loaded as a worker module, and onmessage is
 * undefined when loaded as a node test
 */
if (typeof window === 'undefined' && typeof onmessage !== 'undefined') {
  const cachedDecoder = new CachedDecoder();

  // setLoggingLevel(LoggingLevel.TRACE);
  onmessage = (e: MessageEvent) => {
    trace('Processing web worker event: %o', e);
    const message = e.data as Partial<MessageRequest>;
    switch (message.messageType) {
      case 'ENCODE': {
        const {boardState} = message;
        assertBoardState(boardState);
        const encodedBoardState = cachedDecoder.encodeBoardState(boardState);
        postMessage({
          messageType: 'ENCODE',
          encodedBoardState,
        });
        break;
      }
      case 'DECODE': {
        const {encodedBoardState} = message;
        assertEncodedBoardState(encodedBoardState);
        const boardState = decodeBoardState(encodedBoardState);
        postMessage({
          messageType: 'DECODE',
          boardState,
        } as DecodeMessageResponse);
        break;
      }
      default:
        throw new Error('Unknown message type: ' + message.messageType);
    }
  };
}
