import { assert } from "../util/assert.js";
import { decodeBase64, encodeBase64 } from "../util/base64.js";
import { decodeValue, encodeValueToBitSet } from "../util/compression/arithmetic.js";
import { BitSetWriter } from "../util/io.js";
import { trace } from "../util/logging.js";
import { MineBoardCoder, assertBoardInfo } from "./minesweeper_storage.js";
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
                let { boardInfo } = message;
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
            case 'STATS': {
                const { boardInfo } = message;
                assertBoardInfo(boardInfo);
                postMessage({
                    messageType: 'STATS',
                    stats: {}, // getStats(boardInfo),
                });
                break;
            }
            default:
                throw new Error('Unknown message type: ' + message.messageType);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9hcmRfaWRfd29ya2VyX2VudHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21pbmVzd2VlcGVyL2JvYXJkX2lkX3dvcmtlcl9lbnRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDckYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUM3QyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFM0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUUzRTs7O0dBR0c7QUFDSCxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsSUFBSSxPQUFPLFNBQVMsS0FBSyxXQUFXLEVBQUUsQ0FBQztJQUN0RSx3Q0FBd0M7SUFDeEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQztJQUV4Qyx1Q0FBdUM7SUFDdkMsU0FBUyxHQUFHLENBQUMsQ0FBZSxFQUFFLEVBQUU7UUFDOUIsS0FBSyxDQUFDLGlDQUFpQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVDLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxJQUErQixDQUFDO1FBQ2xELFFBQVEsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzVCLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDZCxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsT0FBTyxDQUFDO2dCQUM1QixlQUFlLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNCLE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FDMUIsbUJBQW1CLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUN0RCxDQUFDO2dCQUNGLFdBQVcsQ0FBQztvQkFDVixXQUFXLEVBQUUsUUFBUTtvQkFDckIsT0FBTztpQkFDUixDQUFDLENBQUM7Z0JBQ0gsTUFBTTtZQUNSLENBQUM7WUFDRCxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ2QsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLE9BQU8sQ0FBQztnQkFDNUIsTUFBTSxDQUNKLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFDM0Isb0JBQW9CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FDL0MsQ0FBQztnQkFDRixNQUFNLE1BQU0sR0FBRyxJQUFJLFlBQVksRUFBRSxDQUFDO2dCQUNsQyxZQUFZLENBQUMsT0FBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUMvQixNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDcEUsV0FBVyxDQUFDO29CQUNWLFdBQVcsRUFBRSxRQUFRO29CQUNyQixTQUFTO2lCQUNlLENBQUMsQ0FBQztnQkFDNUIsTUFBTTtZQUNSLENBQUM7WUFDRCxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ2IsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLE9BQU8sQ0FBQztnQkFDOUIsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQixXQUFXLENBQUM7b0JBQ1YsV0FBVyxFQUFFLE9BQU87b0JBQ3BCLEtBQUssRUFBRSxFQUFFLEVBQUUsdUJBQXVCO2lCQUNYLENBQUMsQ0FBQztnQkFDM0IsTUFBTTtZQUNSLENBQUM7WUFDRDtnQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRSxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0FBQ0osQ0FBQyJ9