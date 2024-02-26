import { assert } from "../util/assert.js";
import { decodeBase64, encodeBase64 } from "../util/base64.js";
import { decodeValue, encodeValueToBitSet } from "../util/compression/arithmetic.js";
import { BitSetWriter } from "../util/io.js";
import { trace } from "../util/logging.js";
import { DecodeMessageResponse, MessageRequest, StatsMessageResponse } from "../minesweeper/board_id_worker.js";
import { MineBoardCoder, assertBoardInfo } from "../minesweeper/minesweeper_storage.js";

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
