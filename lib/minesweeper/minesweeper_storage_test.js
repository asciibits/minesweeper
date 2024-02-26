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
                const openings = Array.from({ length: numberOfOpenings }).map(v => ({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZXN3ZWVwZXJfc3RvcmFnZV90ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21pbmVzd2VlcGVyL21pbmVzd2VlcGVyX3N0b3JhZ2VfdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0wsV0FBVyxFQUNYLG1CQUFtQixHQUNwQixNQUFNLG1DQUFtQyxDQUFDO0FBRzNDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMvQyxPQUFPLEVBQVEsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2hGLE9BQU8sRUFHTCxjQUFjLEVBQ2QsU0FBUyxHQUNWLE1BQU0sMEJBQTBCLENBQUM7QUFFbEMsUUFBUSxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtJQUNuQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFO1FBQzlCLEVBQUUsQ0FBQywyQ0FBMkMsRUFBRSxHQUFHLEVBQUU7WUFDbkQsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ25CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbEQsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxTQUFTLEdBQUcsS0FBSyxHQUFHLE1BQU0sQ0FBQztnQkFDakMsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDN0QsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixDQUMvQyxLQUFLLEVBQ0wsTUFBTSxF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