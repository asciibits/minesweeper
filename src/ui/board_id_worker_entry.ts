import {trace} from '../util/logging.js';
import {
  DecodeMessageResponse,
  MessageRequest,
} from '../minesweeper/board_id_worker.js';
import {
  assertBoardState,
  assertEncodedBoardState,
  decodeBoardState,
  encodeBoardState,
} from '../minesweeper/minesweeper_storage.js';

/**
 * window is undefined when this is loaded as a worker module, and onmessage is
 * undefined when loaded as a node test
 */
if (typeof window === 'undefined' && typeof onmessage !== 'undefined') {
  // setLoggingLevel(LoggingLevel.TRACE);
  onmessage = (e: MessageEvent) => {
    trace('Processing web worker event: %o', e);
    const message = e.data as Partial<MessageRequest>;
    switch (message.messageType) {
      case 'ENCODE': {
        const {boardState} = message;
        assertBoardState(boardState);
        const encodedBoardState = encodeBoardState(boardState);
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
