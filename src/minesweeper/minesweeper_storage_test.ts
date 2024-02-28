import {
  decodeValue,
  encodeValueToBitSet,
} from '../util/compression/arithmetic.js';
import {BitSet} from '../util/io.js';
import {testRandom} from '../util/random.js';
import {Cell, CellVisibleState, MineBoard, MineField} from './minesweeper.js';
import {
  KnownBoardInfo,
  KnownCell,
  MineBoardCoder,
  OpenState,
} from './minesweeper_storage.js';

describe('Minesweeper Storage', () => {
  describe('MineBoardCoder', () => {
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
        const boardInfo: KnownBoardInfo = {
          height,
          width,
          elapsedTime: 0,
          cellData,
        };
        const coder = new MineBoardCoder();
        let boardId: BitSet | undefined = undefined;
        let restoredBoardInfo: KnownBoardInfo | undefined = undefined;
        try {
          boardId = encodeValueToBitSet(boardInfo, coder);
          // console.log('ratio" %d', boardId.length / cellCount);
          restoredBoardInfo = decodeValue(boardId.toReader(), coder);
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
        const boardInfo: KnownBoardInfo = {
          height,
          width,
          elapsedTime: 0,
          cellData,
        };
        const coder = new MineBoardCoder();
        let boardId: BitSet | undefined = undefined;
        let restoredBoardInfo: KnownBoardInfo | undefined = undefined;
        try {
          boardId = encodeValueToBitSet(boardInfo, coder);
          // console.log('ratio" %d', boardId.length / cellCount);
          restoredBoardInfo = decodeValue(boardId.toReader(), coder);
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
    }); // fit('test single round trip', () => {
    //   setLoggingLevel(LoggingLevel.TRACE);
    //   const width = 10;
    //   const height = 10;
    //   const cellCount = width * height;
    //   const mineMap = 0n;
    //   const openMap = 0n
    //   const cellData: KnownCell[] = [];
    //   for (let i = 0; i < cellCount; i++) {
    //     const isMine = !!(mineMap & (1n << BigInt(i)));
    //     const isOpen = !!(openMap & (1n << BigInt(i)));
    //     cellData[i] = {
    //       isMine: !!(mineMap & (1n << BigInt(i))),
    //       openState: isOpen
    //         ? isMine
    //           ? OpenState.FLAGGED
    //           : OpenState.OPENED
    //         : OpenState.CLOSED,
    //     };
    //   }
    //   const boardInfo: KnownBoardInfo = {
    //     height,
    //     width,
    //     cellData,
    //   };
    //   const coder = new MineBoardCoder();
    //   let boardId: BitSet | undefined = undefined;
    //   let restoredBoardInfo: KnownBoardInfo | undefined = undefined;
    //   try {
    //     boardId = encodeValueToBitSet(boardInfo, coder);
    //     restoredBoardInfo = decodeValue(boardId.toReader(), coder);
    //     throwUnless(restoredBoardInfo).toEqual(boardInfo);
    //   } catch (e) {
    //     console.log('Error in round trip. Debug info: %o', {
    //       width,
    //       height,
    //       mineMap: mineMap.toString(2),
    //       openMap: openMap.toString(2),
    //       restoredBoardInfo: {
    //         width: restoredBoardInfo?.width,
    //         height: restoredBoardInfo?.height,
    //         mineMap: restoredBoardInfo?.cellData
    //           .map(c => (c.isMine ? '1' : '0'))
    //           .reverse()
    //           .join(''),
    //       },
    //     });

    //     console.log(
    //       'MineMap: \n' +
    //         MineField.createMineFieldWithMineMap(
    //           width,
    //           height,
    //           [
    //             ...biterator(
    //               new BitSetWriter().writeBigBits(mineMap).bitset.toReader()
    //             ),
    //           ].map(b => !!b)
    //         )
    //     );
    //     console.log(
    //       'OpenMap: \n' +
    //         MineField.createMineFieldWithMineMap(
    //           width,
    //           height,
    //           [
    //             ...biterator(
    //               new BitSetWriter().writeBigBits(openMap).bitset.toReader()
    //             ),
    //           ].map(b => !!b)
    //         )
    //     );

    //     throw e;
    //   }
    // });
  });
});
