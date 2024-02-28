import { decodeValue, encodeValueToBitSet, } from '../util/compression/arithmetic.js';
import { testRandom } from '../util/random.js';
import { CellVisibleState, MineBoard, MineField } from './minesweeper.js';
import { MineBoardCoder, OpenState, } from './minesweeper_storage.js';
describe('Minesweeper Storage', () => {
    describe('MineBoardCoder', () => {
        it('round trip encode/decode for random board', () => {
            const samples = 25;
            for (let i = 0; i < samples; i++) {
                const width = testRandom.getRandomInteger(150, 1);
                const height = testRandom.getRandomInteger(150, 1);
                const cellCount = width * height;
                const mineCount = testRandom.getRandomInteger(cellCount + 1);
                const mineField = MineField.createRandomMineField(width, height, mineCount);
                const cellData = [];
                for (let i = 0; i < cellCount; i++) {
                    const isMine = mineField.getValueMap()[i] === CellVisibleState.MINE;
                    const openState = testRandom.getRandomInteger(3);
                    cellData[i] = {
                        isMine,
                        openState,
                    };
                }
                const boardInfo = {
                    height,
                    width,
                    elapsedTime: 0,
                    cellData,
                };
                const coder = new MineBoardCoder();
                let boardId = undefined;
                let restoredBoardInfo = undefined;
                try {
                    boardId = encodeValueToBitSet(boardInfo, coder);
                    // console.log('ratio" %d', boardId.length / cellCount);
                    restoredBoardInfo = decodeValue(boardId.toReader(), coder);
                    throwUnless(restoredBoardInfo).toEqual(boardInfo);
                }
                catch (e) {
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
                const openings = Array.from({ length: numberOfOpenings }).map(() => ({
                    x: testRandom.getRandomInteger(width),
                    y: testRandom.getRandomInteger(height),
                }));
                const reserved = new Set();
                for (const { x, y } of openings) {
                    for (let dx = Math.max(x - 1, 0); dx < Math.min(x + 2, width); dx++) {
                        for (let dy = Math.max(y - 1, 0); dy < Math.min(y + 2, height); dy++) {
                            reserved.add(dy * height + dx);
                        }
                    }
                }
                const mineCount = testRandom.getRandomInteger(cellCount + 1 - reserved.size);
                const mineField = MineField.createRandomMineField(width, height, mineCount, [...reserved]);
                const board = new MineBoard(mineField);
                const unprocessed = new Set();
                for (const { x, y } of openings) {
                    const cell = board.getCell(x, y);
                    cell.open();
                    unprocessed.add(cell);
                }
                const processed = new Set();
                const border = new Set();
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
                        }
                        else {
                            border.add(n);
                        }
                    }
                }
                for (const c of border) {
                    if (mineField.getCellValue(c.position.x, c.position.y) ===
                        CellVisibleState.MINE) {
                        c.flag();
                    }
                    else {
                        c.open();
                    }
                }
                const cellData = [];
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
                const boardInfo = {
                    height,
                    width,
                    elapsedTime: 0,
                    cellData,
                };
                const coder = new MineBoardCoder();
                let boardId = undefined;
                let restoredBoardInfo = undefined;
                try {
                    boardId = encodeValueToBitSet(boardInfo, coder);
                    // console.log('ratio" %d', boardId.length / cellCount);
                    restoredBoardInfo = decodeValue(boardId.toReader(), coder);
                    throwUnless(restoredBoardInfo).toEqual(boardInfo);
                }
                catch (e) {
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
        //   const mineMap =
        //     0b1011100000010110000011011100110110000101110100001100100001101111001011011011001110011010100100011100n;
        //   const openMap =
        //     0b0100101101011100000110000110000010001101010110011110111100001101101101100111100001011010101010010111n;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZXN3ZWVwZXJfc3RvcmFnZV90ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21pbmVzd2VlcGVyL21pbmVzd2VlcGVyX3N0b3JhZ2VfdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsV0FBVyxFQUNYLG1CQUFtQixHQUNwQixNQUFNLG1DQUFtQyxDQUFDO0FBRTNDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQVEsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2hGLE9BQU8sRUFHTCxjQUFjLEVBQ2QsU0FBUyxHQUNWLE1BQU0sMEJBQTBCLENBQUM7QUFFbEMsUUFBUSxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtJQUNuQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFO1FBQzlCLEVBQUUsQ0FBQywyQ0FBMkMsRUFBRSxHQUFHLEVBQUU7WUFDbkQsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ25CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbEQsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxTQUFTLEdBQUcsS0FBSyxHQUFHLE1BQU0sQ0FBQztnQkFDakMsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDN0QsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixDQUMvQyxLQUFLLEVBQ0wsTUFBTSxF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