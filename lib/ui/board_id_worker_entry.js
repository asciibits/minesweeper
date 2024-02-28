import { assert } from '../util/assert.js';
import { decodeBase64, encodeBase64 } from '../util/base64.js';
import { decodeValue, encodeValueToBitSet, } from '../util/compression/arithmetic.js';
import { BitSetWriter } from '../util/io.js';
import { trace } from '../util/logging.js';
import { MineBoardCoder, assertBoardInfo, } from '../minesweeper/minesweeper_storage.js';
/**
 * window is undefined when this is loaded as a worker module, and onmessage is
 * undefined when loaded as a node test
 */
if (typeof window === 'undefined' && typeof onmessage !== 'undefined') {
    /** Set up the board message handling */
    const boardCoder = new MineBoardCoder();
    // setLoggingLevel(LoggingLevel.TRACE);
    onmessage = (e) => {
        trace('Processing web worker event: %o', e);
        const message = e.data;
        switch (message.messageType) {
            case 'ENCODE': {
                const { boardInfo } = message;
                assertBoardInfo(boardInfo);
                const boardId = encodeBase64(encodeValueToBitSet(boardInfo, boardCoder).toReader());
                postMessage({
                    messageType: 'ENCODE',
                    boardId,
                });
                break;
            }
            case 'DECODE': {
                const { boardId } = message;
                assert(typeof boardId === 'string', 'Invalid board id: ' + JSON.stringify(boardId));
                const writer = new BitSetWriter();
                decodeBase64(boardId, writer);
                const boardInfo = decodeValue(writer.bitset.toReader(), boardCoder);
                postMessage({
                    messageType: 'DECODE',
                    boardInfo,
                });
                break;
            }
            default:
                throw new Error('Unknown message type: ' + message.messageType);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9hcmRfaWRfd29ya2VyX2VudHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3VpL2JvYXJkX2lkX3dvcmtlcl9lbnRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDekMsT0FBTyxFQUFDLFlBQVksRUFBRSxZQUFZLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RCxPQUFPLEVBQ0wsV0FBVyxFQUNYLG1CQUFtQixHQUNwQixNQUFNLG1DQUFtQyxDQUFDO0FBQzNDLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDM0MsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBS3pDLE9BQU8sRUFDTCxjQUFjLEVBQ2QsZUFBZSxHQUNoQixNQUFNLHVDQUF1QyxDQUFDO0FBRS9DOzs7R0FHRztBQUNILElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxJQUFJLE9BQU8sU0FBUyxLQUFLLFdBQVcsRUFBRSxDQUFDO0lBQ3RFLHdDQUF3QztJQUN4QyxNQUFNLFVBQVUsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO0lBRXhDLHVDQUF1QztJQUN2QyxTQUFTLEdBQUcsQ0FBQyxDQUFlLEVBQUUsRUFBRTtRQUM5QixLQUFLLENBQUMsaUNBQWlDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLElBQStCLENBQUM7UUFDbEQsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDNUIsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNkLE1BQU0sRUFBQyxTQUFTLEVBQUMsR0FBRyxPQUFPLENBQUM7Z0JBQzVCLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0IsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUMxQixtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQ3RELENBQUM7Z0JBQ0YsV0FBVyxDQUFDO29CQUNWLFdBQVcsRUFBRSxRQUFRO29CQUNyQixPQUFPO2lCQUNSLENBQUMsQ0FBQztnQkFDSCxNQUFNO1lBQ1IsQ0FBQztZQUNELEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDZCxNQUFNLEVBQUMsT0FBTyxFQUFDLEdBQUcsT0FBTyxDQUFDO2dCQUMxQixNQUFNLENBQ0osT0FBTyxPQUFPLEtBQUssUUFBUSxFQUMzQixvQkFBb0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUMvQyxDQUFDO2dCQUNGLE1BQU0sTUFBTSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ2xDLFlBQVksQ0FBQyxPQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQy9CLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUNwRSxXQUFXLENBQUM7b0JBQ1YsV0FBVyxFQUFFLFFBQVE7b0JBQ3JCLFNBQVM7aUJBQ2UsQ0FBQyxDQUFDO2dCQUM1QixNQUFNO1lBQ1IsQ0FBQztZQUNEO2dCQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7SUFDSCxDQUFDLENBQUM7QUFDSixDQUFDIn0=