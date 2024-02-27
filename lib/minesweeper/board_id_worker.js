import { error, info, trace } from '../util/logging.js';
import { assert } from '../util/assert.js';
import { BoardEventType, CellVisibleState, MineField, mineFieldsEqual, } from './minesweeper.js';
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
                // force a TIME event
                if (board.isComplete() || board.isExploded()) {
                    board.fireEvent(BoardEventType.TIME_ELAPSED, { DECODING: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9hcmRfaWRfd29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21pbmVzd2VlcGVyL2JvYXJkX2lkX3dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUNMLGNBQWMsRUFFZCxnQkFBZ0IsRUFFaEIsU0FBUyxFQUVULGVBQWUsR0FDaEIsTUFBTSxrQkFBa0IsQ0FBQztBQUMxQixPQUFPLEVBRUwsU0FBUyxFQUNULGVBQWUsR0FDaEIsTUFBTSwwQkFBMEIsQ0FBQztBQXlEbEMsTUFBTSxPQUFPLGFBQWE7SUFDUCxNQUFNLENBQVM7SUFDZixlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7SUFDbkQsZUFBZSxHQUFHLElBQUksR0FBRyxFQUF5QixDQUFDO0lBQ25ELGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBaUIsQ0FBQztJQUMxQyxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQW9DLENBQUM7SUFDdEUsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUUzQjs7O09BR0c7SUFDSyxXQUFXLENBSWpCO0lBRUY7UUFDRSxJQUFJLENBQUMsMENBQTBDLENBQUMsQ0FBQztRQUNqRCxJQUFJLEdBQVcsQ0FBQztRQUNoQixJQUNFLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNuQyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFDakMsQ0FBQztZQUNELG1EQUFtRDtZQUNuRCxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1lBQ3hFLEdBQUcsR0FBRyxHQUFHLENB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