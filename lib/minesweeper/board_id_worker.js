import { error, info, trace } from '../util/logging.js';
import { assert } from '../util/assert.js';
import { BoardEventType, CellVisibleState, MineField, mineFieldsEqual, } from './minesweeper.js';
import { OpenState, assertBoardInfo, } from './minesweeper_storage.js';
export class BoardIdWorker {
    worker;
    encodeListeners = new Set();
    decodeListeners = new Set();
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
     *
     * @param board The board to receive all decoded info.
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
                // force a TIME event for completed game
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
    terminate() {
        this.terminated = true;
        this.encodeListeners.clear();
        this.decodeListeners.clear();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9hcmRfaWRfd29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21pbmVzd2VlcGVyL2JvYXJkX2lkX3dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDM0MsT0FBTyxFQUNMLGNBQWMsRUFFZCxnQkFBZ0IsRUFFaEIsU0FBUyxFQUVULGVBQWUsR0FDaEIsTUFBTSxrQkFBa0IsQ0FBQztBQUMxQixPQUFPLEVBRUwsU0FBUyxFQUNULGVBQWUsR0FDaEIsTUFBTSwwQkFBMEIsQ0FBQztBQW9DbEMsTUFBTSxPQUFPLGFBQWE7SUFDUCxNQUFNLENBQVM7SUFDZixlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7SUFDbkQsZUFBZSxHQUFHLElBQUksR0FBRyxFQUF5QixDQUFDO0lBQ25ELGNBQWMsR0FBRyxJQUFJLEdBQUcsRUFBb0MsQ0FBQztJQUN0RSxVQUFVLEdBQUcsS0FBSyxDQUFDO0lBRTNCOzs7T0FHRztJQUNLLFdBQVcsQ0FJakI7SUFFRjtRQUNFLElBQUksQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1FBQ2pELElBQUksR0FBVyxDQUFDO1FBQ2hCLElBQ0UsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ25DLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUNqQyxDQUFDO1lBQ0QsbURBQW1EO1lBQ25ELE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDeEUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FB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