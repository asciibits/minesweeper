import { error, info, trace } from '../util/logging.js';
import { assert } from '../util/assert.js';
import { CellVisibleState, MineField, mineFieldsEqual, } from './minesweeper.js';
import { OpenState, assertBoardInfo, } from './minesweeper_storage.js';
export class BoardIdWorker {
    worker;
    encodeListeners = new Set();
    decodeListeners = new Set();
    statsListeners = new Set();
    boardListeners = new Map();
    terminated = false;
    /**
     * The last view decoded. This offers a simple cache for multiple calls to
     * requestEncode with the same view, but different exposed
     */
    lastEncoded;
    constructor() {
        info('[BoardIdWorker] Starting Board ID worker');
        let url;
        if (!inlinedWorkerCode.startsWith('<<') &&
            !inlinedWorkerCode.endsWith('>>')) {
            // dist mode - use the inlined worker code directly
            const blob = new Blob([inlinedWorkerCode], { type: 'text/javascript' });
            url = URL.createObjectURL(blob);
        }
        else {
            // deveoper mode - pull in the library directly
            url = '../lib/ui/board_id_worker_entry.js';
        }
        this.worker = new Worker(url, {
            type: 'module',
            name: 'BoardIdWorker',
        });
        this.worker.onerror = (e) => {
            error('[BoardIdWorker.worker.onerror] Got error. Message: %o\nError: %o\nfilename: %o\nlineno: %o\nevent: %o', e.message, e.error, e.filename, e.lineno, e);
        };
        this.worker.onmessageerror = (e) => {
            error('[BoardIdWorker.worker.onerror] Got error. Data: %oevent: %o', e.data, e);
        };
        this.worker.onmessage = (e) => {
            trace('[BoardIdWorker.worker.onmessage] Message to worker received: %o', e);
            const messageResponse = e.data;
            switch (messageResponse.messageType) {
                case 'DECODE':
                    const { boardInfo } = messageResponse;
                    assertBoardInfo(boardInfo);
                    this.decodeListeners.forEach(l => l.handleDecodeResponse(boardInfo));
                    break;
                case 'ENCODE':
                    const { boardId } = messageResponse;
                    assert(typeof boardId === 'string', 'Invalid board id: ' + JSON.stringify(boardId));
                    this.encodeListeners.forEach(l => l.handleEncodeResponse(boardId));
                    break;
                case 'STATS':
                    let { stats } = messageResponse;
                    assert(stats, 'Stats not found in response');
                    this.statsListeners.forEach(l => l.handleStatsResponse(stats));
                    break;
                default:
                    throw new Error('Unrecognized message response type: ' +
                        JSON.stringify(messageResponse));
            }
        };
        info('[BoardIdWorker] Board ID worker initialized');
    }
    requestEncode(board) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        const view = board.getView();
        if (this.lastEncoded?.view === view) {
            for (const listener of this.encodeListeners) {
                listener.handleEncodeResponse;
            }
        }
        const boardInfo = getBoardInfo(board);
        trace('[BoardIdWorker.requestEncode] Sending encode request: %o', boardInfo);
        this.worker.postMessage({
            messageType: 'ENCODE',
            boardInfo,
        });
    }
    requestDecode(boardId) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.requestDecode] Sending decode request: %o', boardId);
        this.worker.postMessage({
            messageType: 'DECODE',
            boardId,
        });
    }
    requestStats(board) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        const start = Date.now();
        const boardInfo = getBoardInfo(board);
        const mid = Date.now();
        trace('[BoardIdWorker.requestStats] Sending encode request: %o', boardInfo);
        const mid2 = Date.now();
        this.worker.postMessage({
            messageType: 'STATS',
            boardInfo,
        });
        const end = Date.now();
    }
    addEncodeListener(listener) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.addEncodeListener]');
        this.encodeListeners.add(listener);
    }
    removeEncodeListener(listener) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.removeEncodeListener]');
        this.encodeListeners.delete(listener);
    }
    addDecodeListener(listener) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.addDecodeListener]');
        this.decodeListeners.add(listener);
    }
    removeDecodeListener(listener) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.removeDecodeListener]');
        this.decodeListeners.delete(listener);
    }
    /**
     * Add a decode listener that updates a given `MineBoard`. All events will
     * have the attribute: 'DECODING; set to 'true;
     */
    addDecodeToBoardListener(board) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.addDecodeToBoardListener]');
        const listener = {
            handleDecodeResponse: (boardInfo) => {
                const mineField = getMineField(boardInfo);
                // only reset the board if we have a new minefield. This optimization
                // prevents building up the entire board when only a part of it is
                // changing
                const needsReset = !mineFieldsEqual(mineField, board.getView());
                if (needsReset) {
                    board.reset(mineField, { DECODING: true });
                }
                const openMines = new Set();
                for (let i = 0; i < boardInfo.cellData.length; i++) {
                    const cell = board.getCell(i);
                    cell.setWrong(false, { DECODING: true });
                    switch (boardInfo.cellData[i].openState) {
                        case OpenState.OPENED:
                            if (cell.isMine()) {
                                openMines.add(cell);
                            }
                            else {
                                cell.openNoExpand({ DECODING: true });
                            }
                            break;
                        case OpenState.FLAGGED:
                            cell.close({ DECODING: true });
                            cell.flag(true, { DECODING: true });
                            break;
                        default:
                            cell.close({ DECODING: true });
                            cell.flag(false, { DECODING: true });
                            break;
                    }
                }
                // open mines after the rest of the board is build (allows the UI to
                // have everything else properly rendered before showing the bomb
                // status)
                board.openGroup(openMines, { DECODING: true });
                if (needsReset) {
                    board.setTimeElapsed(boardInfo.elapsedTime, { DECODING: true });
                }
            },
        };
        this.removeDecodeToBoardListener(board);
        this.boardListeners.set(board, listener);
        this.addDecodeListener(listener);
    }
    removeDecodeToBoardListener(board) {
        const listener = this.boardListeners.get(board);
        if (listener) {
            this.removeDecodeListener(listener);
            this.boardListeners.delete(board);
        }
    }
    addStatsListener(listener) {
        assert(!this.terminated, 'BoardIdWorker has been terminated');
        trace('[BoardIdWorker.addStatsListener]');
        this.statsListeners.add(listener);
    }
    removeStatsListener(listener) {
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
function getMineField(boardInfo) {
    const { width, height, cellData } = boardInfo;
    return MineField.createMineFieldWithMineMap(width, height, cellData.map(c => c.isMine));
}
function getBoardInfo(board) {
    const elapsedTime = board.getTimeElapsed();
    const view = board.getView();
    const { width, height } = view;
    const cellData = board.getAllCells().map(c => ({
        isMine: view.getCellValue(c.position.x, c.position.y) === CellVisibleState.MINE,
        openState: c.isOpened()
            ? OpenState.OPENED
            : c.isFlagged()
                ? OpenState.FLAGGED
                : OpenState.CLOSED,
    }));
    return { width, height, elapsedTime, cellData };
}
/** This is populated when creating the 'dist' */
const inlinedWorkerCode = '<<BOARD_ID_WORKER_ENTRY>>';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9hcmRfaWRfd29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21pbmVzd2VlcGVyL2JvYXJkX2lkX3dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUVMLGdCQUFnQixFQUVoQixTQUFTLEVBRVQsZUFBZSxHQUNoQixNQUFNLGtCQUFrQixDQUFDO0FBQzFCLE9BQU8sRUFFTCxTQUFTLEVBQ1QsZUFBZSxHQUNoQixNQUFNLDBCQUEwQixDQUFDO0FBeURsQyxNQUFNLE9BQU8sYUFBYTtJQUNQLE1BQU0sQ0FBUztJQUNmLGVBQWUsR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztJQUNuRCxlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7SUFDbkQsY0FBYyxHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO0lBQzFDLGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBb0MsQ0FBQztJQUN0RSxVQUFVLEdBQUcsS0FBSyxDQUFDO0lBRTNCOzs7T0FHRztJQUNLLFdBQVcsQ0FJakI7SUFFRjtRQUNFLElBQUksQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1FBQ2pELElBQUksR0FBVyxDQUFDO1FBQ2hCLElBQ0UsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ25DLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUNqQyxDQUFDO1lBQ0QsbURBQW1EO1lBQ25ELE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDeEUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxlQUFlLENB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