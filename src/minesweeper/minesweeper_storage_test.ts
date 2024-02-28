import {testRandom} from '../util/random.js';
import {Cell, CellVisibleState, MineBoard, MineField} from './minesweeper.js';
import {
  KnownBoardState,
  KnownCell,
  encodeBoardState,
  decodeBoardState,
  OpenState,
  EncodedBoardState,
} from './minesweeper_storage.js';

describe('Minesweeper Storage', () => {
  describe('encode/decode Board State', () => {
    it('round trip encode/decode for random board', () => {
      const samples = 25;
      for (let i = 0; i < samples; i++) {
        const width = testRandom.getRandomInteger(150, 1);
        const height = testRandom.getRandomInteger(150, 1);
        const cellCount = width * height;
        const mineCount = testRandom.getRandomInteger(cellCount + 1);
        const mineField = MineField.createRandomMineField(
          width,
          height,
          mineCount,
        );

        const cellData: KnownCell[] = [];
        for (let i = 0; i < cellCount; i++) {
          const isMine = mineField.getValueMap()[i] === CellVisibleState.MINE;
          const openState = testRandom.getRandomInteger(3) as OpenState;
          cellData[i] = {
            isMine,
            openState,
          };
        }
        const boardInfo: KnownBoardState = {
          height,
          width,
          cellData,
        };
        let encoded: EncodedBoardState | undefined = undefined;
        let restoredBoardInfo: KnownBoardState | undefined = undefined;
        try {
          encoded = encodeBoardState(boardInfo);
          // console.log('ratio" %d', boardId.length / cellCount);
          restoredBoardInfo = decodeBoardState(encoded);
          throwUnless(restoredBoardInfo).toEqual(boardInfo);
        } catch (e) {
          console.log('Error in round trip. Debug info: %o', {
            width,
            height,
            mineCount,
            cellData,
            restoredBoardInfo: {
              width: restoredBoardInfo?.width,
              height: restoredBoardInfo?.height,
              cellData: restoredBoardInfo?.cellData,
            },
            i,
          });

          throw e;
        }
      }
    });
    it('round trip encode/decode for more standard board', () => {
      const samples = 25;
      for (let i = 0; i < samples; i++) {
        const width = testRandom.getRandomInteger(150, 1);
        const height = testRandom.getRandomInteger(150, 1);
        const cellCount = width * height;
        const numberOfOpenings = testRandom.getRandomInteger(6, 1);
        const openings = Array.from({length: numberOfOpenings}).map(() => ({
          x: testRandom.getRandomInteger(width),
          y: testRandom.getRandomInteger(height),
        }));
        const reserved = new Set<number>();
        for (const {x, y} of openings) {
          for (let dx = Math.max(x - 1, 0); dx < Math.min(x + 2, width); dx++) {
            for (
              let dy = Math.max(y - 1, 0);
              dy < Math.min(y + 2, height);
              dy++
            ) {
              reserved.add(dy * height + dx);
            }
          }
        }
        const mineCount = testRandom.getRandomInteger(
          cellCount + 1 - reserved.size,
        );

        const mineField = MineField.createRandomMineField(
          width,
          height,
          mineCount,
          [...reserved],
        );
        const board = new MineBoard(mineField);
        const unprocessed = new Set<Cell>();
        for (const {x, y} of openings) {
          const cell = board.getCell(x, y);
          cell.open();
          unprocessed.add(cell);
        }

        const processed = new Set<Cell>();
        const border = new Set<Cell>();
        function pop() {
          for (const cell of unprocessed) {
            unprocessed.delete(cell);
            return cell;
          }
          throw new Error('empty');
        }
        while (unprocessed.size) {
          const cell = pop();
          processed.add(cell);
          for (const n of cell.getNeighbors()) {
            if (n.isOpened()) {
              if (!processed.has(n)) {
                unprocessed.add(n);
              }
            } else {
              border.add(n);
            }
          }
        }
        for (const c of border) {
          if (
            mineField.getCellValue(c.position.x, c.position.y) ===
            CellVisibleState.MINE
          ) {
            c.flag();
          } else {
            c.open();
          }
        }

        const cellData: KnownCell[] = [];
        let i = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++, i++) {
            const isMine = mineField.getValueMap()[i] === CellVisibleState.MINE;
            const cell = board.getCell(x, y);

            cellData.push({
              isMine,
              openState: cell.isOpened()
                ? OpenState.OPENED
                : cell.isFlagged()
                  ? OpenState.FLAGGED
                  : OpenState.CLOSED,
            });
          }
        }
        const boardInfo: KnownBoardState = {
          height,
          width,
          cellData,
        };
        let encoded: EncodedBoardState | undefined = undefined;
        let restoredBoardInfo: KnownBoardState | undefined = undefined;
        try {
          encoded = encodeBoardState(boardInfo);
          // console.log('ratio" %d', boardId.length / cellCount);
          restoredBoardInfo = decodeBoardState(encoded);
          throwUnless(restoredBoardInfo).toEqual(boardInfo);
        } catch (e) {
          console.log('Error in round trip. Debug info: %o', {
            width,
            height,
            mineCount,
            cellData,
            restoredBoardInfo: {
              width: restoredBoardInfo?.width,
              height: restoredBoardInfo?.height,
              mineMap: restoredBoardInfo?.cellData,
            },
            i,
          });

          throw e;
        }
      }
    });
    // fit('test single round trip', () => {
    //   // setLoggingLevel(LoggingLevel.TRACE);
    //   const width = 2;
    //   const height = 2;

    //   const cellData: KnownCell[] = [
    //     {isMine: true, openState: OpenState.FLAGGED},
    //     {isMine: false, openState: OpenState.CLOSED},
    //     {isMine: false, openState: OpenState.CLOSED},
    //     {isMine: false, openState: OpenState.OPENED},
    //   ];
    //   const boardState: KnownBoardState = {
    //     height,
    //     width,
    //     cellData,
    //   };
    //   let encoded: EncodedBoardState | undefined = undefined;
    //   let restoredBoardState: KnownBoardState | undefined = undefined;
    //   try {
    //     encoded = encodeBoardState(boardState);
    //     // console.log('ratio" %d', boardId.length / cellCount);
    //     restoredBoardState = decodeBoardState(encoded);
    //     throwUnless(restoredBoardState).toEqual(boardState);
    //   } catch (e) {
    //     console.log('Error in round trip. Debug state: %o', {
    //       boardState,
    //       restoredBoardState,
    //     });

    //     throw e;
    //   }
    // });
  });
});
