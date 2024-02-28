import { combinations } from '../util/combinitorics.js';
import { MineField, OpeningRestrictions } from './minesweeper.js';
describe('MineField', () => {
    it('errors out with zero width or height', () => {
        expect(() => new MineField(0, 1, [])).toThrow();
        expect(() => new MineField(1, 0, [])).toThrow();
    });
    it('errors out when there are more bombs than cells', () => {
        expect(() => new MineField(2, 3, [0, 1, 2, 3, 4, 5, 6])).toThrow();
    });
    it('Allows a bomb-filled field', () => {
        expect(() => new MineField(2, 3, [0, 1, 2, 3, 4, 5])).not.toThrow();
    });
    describe('initBombs', () => {
        it('has Bombs where expected', () => {
            const field = new MineField(4, 3, [
                { x: 2, y: 1 },
                { x: 3, y: 2 },
            ]);
            expect(field.getCellValue(2, 1)).toBeLessThan(0);
            expect(field.getCellValue(3, 2)).toBeLessThan(0);
            for (let x = 0; x < field.width; x++) {
                for (let y = 0; y < field.height; y++) {
                    if ((x === 2 && y === 1) || (x === 3 && y === 2)) {
                        expect(field.getCellValue(x, y)).toBeLessThan(0);
                    }
                    else {
                        expect(field.getCellValue(x, y)).toBeGreaterThanOrEqual(0);
                    }
                }
            }
        });
        it('uses position index as expected', () => {
            // use {x: 2, y: 1} and {x: 3, y: 2} as position indexes
            const field = new MineField(4, 3, [1 * 4 + 2, 2 * 4 + 3]);
            expect(field.getCellValue(2, 1)).toBeLessThan(0);
            expect(field.getCellValue(3, 2)).toBeLessThan(0);
            for (let x = 0; x < field.width; x++) {
                for (let y = 0; y < field.height; y++) {
                    if ((x === 2 && y === 1) || (x === 3 && y === 2)) {
                        expect(field.getCellValue(x, y)).toBeLessThan(0);
                    }
                    else {
                        expect(field.getCellValue(x, y)).toBeGreaterThanOrEqual(0);
                    }
                }
            }
        });
        it('throws if the same cell is marked as a bomb twice', () => {
            expect(() => new MineField(4, 3, [
                { x: 1, y: 2 },
                { x: 1, y: 2 },
            ])).toThrow();
        });
    });
    describe('toString', () => {
        it('provides contents as expected', () => {
            const field = minefield('X . X .', '. X . X', 'X . X .');
            expect(field.toString()).toBe('X3X2\n3X4X\nX3X2');
        });
    });
    describe('cellContents', () => {
        it('provides values as expected', () => {
            const field = minefield('X . X .', '. X . X', 'X . X .');
            expect(field.getCellValue(0, 0)).toBeLessThan(0);
            expect(field.getCellValue(1, 0)).toBe(3);
            expect(field.getCellValue(2, 0)).toBeLessThan(0);
            expect(field.getCellValue(3, 0)).toBe(2);
            expect(field.getCellValue(0, 1)).toBe(3);
            expect(field.getCellValue(1, 1)).toBeLessThan(0);
            expect(field.getCellValue(2, 1)).toBe(4);
            expect(field.getCellValue(3, 1)).toBeLessThan(0);
            expect(field.getCellValue(0, 2)).toBeLessThan(0);
            expect(field.getCellValue(1, 2)).toBe(3);
            expect(field.getCellValue(2, 2)).toBeLessThan(0);
            expect(field.getCellValue(3, 2)).toBe(2);
        });
    });
    describe('getBoardNumber', () => {
        it('returns zero when bombs are all at the end', () => {
            expect(minefield('.').getBoardNumber()).toBe(0n);
            expect(minefield('X').getBoardNumber()).toBe(0n);
            expect(minefield('.XX').getBoardNumber()).toBe(0n);
            expect(minefield('....').getBoardNumber()).toBe(0n);
            expect(minefield('...X').getBoardNumber()).toBe(0n);
            expect(minefield('..XX').getBoardNumber()).toBe(0n);
            expect(minefield('.XXX').getBoardNumber()).toBe(0n);
            expect(minefield('XXXX').getBoardNumber()).toBe(0n);
        });
        it('returns choose - 1 when bombs are all at the beginning', () => {
            expect(minefield('.').getBoardNumber()).toBe(combinations(1, 0) - 1n);
            expect(minefield('X').getBoardNumber()).toBe(combinations(1, 1) - 1n);
            expect(minefield('X.').getBoardNumber()).toBe(combinations(2, 1) - 1n);
            expect(minefield('X..').getBoardNumber()).toBe(combinations(3, 1) - 1n);
            expect(minefield('XX.').getBoardNumber()).toBe(combinations(3, 2) - 1n);
            expect(minefield('....').getBoardNumber()).toBe(combinations(4, 0) - 1n);
            expect(minefield('X...').getBoardNumber()).toBe(combinations(4, 1) - 1n);
            expect(minefield('XX..').getBoardNumber()).toBe(combinations(4, 2) - 1n);
            expect(minefield('XXX.').getBoardNumber()).toBe(combinations(4, 3) - 1n);
            expect(minefield('XXXX').getBoardNumber()).toBe(combinations(4, 4) - 1n);
        });
        it('returns expected id for 5 cells, 2 bombs', () => {
            // with 5 cells, 2 bombs, we have the following lexically ordered fields:
            expect(minefield('...XX').getBoardNumber()).toBe(0n);
            expect(minefield('..X.X').getBoardNumber()).toBe(1n);
            expect(minefield('..XX.').getBoardNumber()).toBe(2n);
            expect(minefield('.X..X').getBoardNumber()).toBe(3n);
            expect(minefield('.X.X.').getBoardNumber()).toBe(4n);
            expect(minefield('.XX..').getBoardNumber()).toBe(5n);
            expect(minefield('X...X').getBoardNumber()).toBe(6n);
            expect(minefield('X..X.').getBoardNumber()).toBe(7n);
            expect(minefield('X.X..').getBoardNumber()).toBe(8n);
            expect(minefield('XX...').getBoardNumber()).toBe(9n);
        });
    });
    describe('createMineFieldWithId', () => {
        it('creates the expected minefield', () => {
            const field = minefield(`
      ..X.
      X...
      ....
      ...X`);
            expect(MineField.createMineFieldWithBoardNumber(field.width, field.height, field.mineCount, field.getBoardNumber()).toString()).toBe(field.toString());
        });
    });
    describe('createRandomMineField', () => {
        it('creates a valid board', () => {
            // This could maybe made deterministic, but it works as is for now
            const field = MineField.createRandomMineField(4, 3, 2);
            // make sure there are exactly 2 bombs
            let bombCount = 0;
            for (let x = 0; x < field.width; x++) {
                for (let y = 0; y < field.height; y++) {
                    if (field.getCellValue(x, y) < 0)
                        bombCount++;
                }
            }
            expect(bombCount).toBe(2);
        });
        it('makes room for an initial position', () => {
            // This could maybe made deterministic, but it works as is for now
            const field = MineField.createRandomMineField(4, 3, 2, [{ x: 2, y: 1 }]);
            expect(field.getCellValue(2, 1)).toBeGreaterThanOrEqual(0);
        });
        it('makes room for an initial zero position', () => {
            // This could maybe made deterministic, but it works as is for now
            const field = MineField.createRandomMineFieldWithOpening(4, 3, 2, { x: 2, y: 1 }, OpeningRestrictions.ZERO);
            expect(field.getCellValue(2, 1)).toBe(0);
            expect(field.getCellValue(1, 0)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(1, 1)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(1, 2)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(2, 0)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(2, 2)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(3, 0)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(3, 1)).toBeGreaterThanOrEqual(0);
            expect(field.getCellValue(3, 2)).toBeGreaterThanOrEqual(0);
        });
    });
});
// describe('Test sizes', () => {
//   fit('compares sizes', () => {
//     setLoggingLevel(LoggingLevel.INFO);
//     const samples = 200;
//     interface Stats {
//       max: number;
//       min: number;
//       sum: number;
//       sumSquared: number;
//     }
//     const allStats = {
//       boardNumberStats: {
//         max: 0,
//         min: 0,
//         sum: 0,
//         sumSquared: 0,
//         average: 0,
//         stdDev: 0,
//       },
//       fixedProbabilityStats: {
//         max: 0,
//         min: 0,
//         sum: 0,
//         sumSquared: 0,
//         average: 0,
//         stdDev: 0,
//       },
//       variableProbabilityStats: {
//         max: 0,
//         min: 0,
//         sum: 0,
//         sumSquared: 0,
//         average: 0,
//         stdDev: 0,
//       },
//       count: 0,
//     };
//     for (let i = 0; i < samples; i++) {
//       const width = 30; // random.getRandomInteger(150, 1);
//       const height = 16; // random.getRandomInteger(150, 1);
//       const mines = 99; // random.getRandomInteger(width * height + 1);
//       const mineField = MineField.createRandomMineField(
//         width,
//         height,
//         mines,
//         [],
//         testRandom
//       );
//       const mineMap = mineField.getMineMap();
//       const boardNumberSet = new BitSet()
//         .iterator()
//         .writeBigBits(mineField.getBoardNumber()).bitset;
//       const fixedProbabilitySet = encodeArithmetic(
//         mineMap,
//         new FixedProbabilityModel(1 - mines / (width * height))
//       ).bitset;
//       const mineMapIter = mineMap.iterator();
//       const variableProbabilitySet = encodeArithmetic(
//         mineMapIter,
//         new MineModel(width * height, mines, mineMapIter)
//       ).bitset;
//       function incStats(stats: Stats, val: number) {
//         stats.max = stats.max === 0 ? val : Math.max(stats.max, val);
//         stats.min = stats.min === 0 ? val : Math.min(stats.min, val);
//         stats.sum += val;
//         stats.sumSquared += val * val;
//       }
//       allStats.count++;
//       incStats(allStats.boardNumberStats, boardNumberSet.length);
//       incStats(allStats.fixedProbabilityStats, fixedProbabilitySet.length);
//       incStats(
//         allStats.variableProbabilityStats,
//         variableProbabilitySet.length
//       );
//       // // make sure the minemap is able to be recreated from the
// //mineModeSet
//       // const decodeIter = new BitSet().iterator();
//       // const decoded = decodeArithmetic(
//       //   mineModelSet,
//       //   new MineModel(width * height, mines, decodeIter),
//       //   width * height,
//       //   decodeIter
//       // ).bitset;
//       // expect(decoded).toEqual(mineMap);
//       // info('Model size comparisons: %o', {
//       //   boardNumber: boardNumberSet.length,
//       //   fixedProbability: fixedProbabilitySet.length,
//       //   variableProbability: variableProbabilitySet.length,
//       // });
//     }
//     allStats.fixedProbabilityStats.average =
//       allStats.fixedProbabilityStats.sum / allStats.count;
//     allStats.variableProbabilityStats.average =
//       allStats.variableProbabilityStats.sum / allStats.count;
//     allStats.boardNumberStats.average =
//       allStats.boardNumberStats.sum / allStats.count;
//     allStats.fixedProbabilityStats.stdDev = Math.sqrt(
//       allStats.fixedProbabilityStats.sumSquared / allStats.count -
//         allStats.fixedProbabilityStats.average ** 2
//     );
//     allStats.variableProbabilityStats.stdDev = Math.sqrt(
//       allStats.variableProbabilityStats.sumSquared / allStats.count -
//         allStats.variableProbabilityStats.average ** 2
//     );
//     allStats.boardNumberStats.stdDev = Math.sqrt(
//       allStats.boardNumberStats.sumSquared / allStats.count -
//         allStats.boardNumberStats.average ** 2
//     );
//     console.log('stats: %o', allStats);
//   });
// });
// describe('Explore state encoding', () => {
//   fit('puts the lotion in the basket', () => {
//     const samples = 100;
//     let matchOnly = 0;
//     let onlyTotal = 0;
//     let matchOne = 0;
//     let bothDifferent = 0;
//     let matchBoth = 0;
//     let bothMatch = 0;
//     let openCount = 0;
//     let count = 0;
//     for (let i = 0; i < samples; i++) {
//       const width = 30;
//       const height = 16;
//       const mines = 99;
//       // const openAreaCount = testRandom.getRandomInteger(6, 3);
//       // const openAreas = [];
//       // for (let i = 0; i < openAreaCount; i++) {
//       //   openAreas.push(testRandom.getRandomInteger(width * height));
//       // }
//       const openCells = new Set<number>();
//       // for (const pos of openAreas) {
//       //   const x = pos % width;
//       //   const y = (pos - x) / width;
//       //   for (
//       //     let dx = Math.max(x - 1, 0);
//       //     dx <= Math.min(x + 1, width - 1);
//       //     dx++
//       //   ) {
//       //     for (
//       //       let dy = Math.max(y - 1, 0);
//       //       dy <= Math.min(y + 1, height - 1);
//       //       dy++
//       //     ) {
//       //       openCells.add(dy * width + dx);
//       //     }
//       //   }
//       // }
//       const mineField = MineField.createRandomMineField(
//         width,
//         height,
//         mines,
//         [...openCells],
//         testRandom
//       );
//       const mineBoard = new MineBoard(mineField);
//       // for (const pos of openAreas) {
//       //   const x = pos % width;
//       //   const y = (pos - x) / width;
//       //   mineBoard.getCell(x, y).open();
//       // }
//       for (let x = 0; x < width; x++) {
//         for (let y = 0; y < height; y++) {
//           if (mineField.cellContents(x, y) >= 0) {
//             mineBoard.getCell(x, y).open();
//           }
//         }
//       }
//       for (let x = 0; x < width; x++) {
//         for (let y = 0; y < height; y++) {
//           const open = mineBoard.getCell(x, y).isOpened();
//           count++;
//           if (open) {
//             openCount++;
//           }
//           const leftOpen =
//             x > 0 ? mineBoard.getCell(x - 1, y).isOpened() : undefined;
//           const upOpen =
//             y > 0 ? mineBoard.getCell(x, y - 1).isOpened() : undefined;
//           if (x === 0) {
//             if (y !== 0) {
//               onlyTotal++;
//               matchOnly += open === upOpen ? 1 : 0;
//             }
//           } else {
//             if (y === 0) {
//               onlyTotal++;
//               matchOnly += open === leftOpen ? 1 : 0;
//             } else if (leftOpen === upOpen) {
//               bothMatch++;
//               matchBoth += open === leftOpen ? 1 : 0;
//             } else {
//               bothDifferent++;
//               matchOne += open ? 1 : 0;
//             }
//           }
//         }
//       }
//     }
//     // tally up the stats
//     const stats = {
//       open: openCount / count,
//       matchOnly: matchOnly / onlyTotal,
//       matchBoth: matchBoth / bothMatch,
//       matchOne: matchOne / bothDifferent,
//     };
//     console.log('Board stats: %o', stats);
//   });
// });
/** Helper function to create a mineField object from a string */
function minefield(...rows) {
    rows = rows
        .flatMap(r => r.split('\n'))
        .map(r => r.trim())
        .filter(r => !!r);
    const height = rows.length;
    let width = 0;
    const bombCells = [];
    // strip all whitespace, and just look for 'X' fields
    rows = rows.map(r => r.replace(/ /g, ''));
    for (let y = 0; y < rows.length; y++) {
        const row = rows[y];
        width = Math.max(width, row.length);
        for (let x = 0; x < row.length; x++) {
            if (row[x] === 'X') {
                bombCells.push({ x, y });
            }
        }
    }
    return new MineField(width, height, bombCells);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWluZXN3ZWVwZXJfdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taW5lc3dlZXBlci9taW5lc3dlZXBlcl90ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUN0RCxPQUFPLEVBQUMsU0FBUyxFQUFFLG1CQUFtQixFQUFXLE1BQU0sa0JBQWtCLENBQUM7QUFFMUUsUUFBUSxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUU7SUFDekIsRUFBRSxDQUFDLHNDQUFzQyxFQUFFLEdBQUcsRUFBRTtRQUM5QyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2hELE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDbEQsQ0FBQyxDQUFDLENBQUM7SUFDSCxFQUFFLENBQUMsaURBQWlELEVBQUUsR0FBRyxFQUFFO1FBQ3pELE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3JFLENBQUMsQ0FBQyxDQUFDO0lBQ0gsRUFBRSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtRQUNwQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENB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LENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqRCxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFD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Q0FDdEQsQ0FBQyxFQUNELENBQUMsRUFDRCxDQUFDLEVBQ0QsRUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUMsRUFDWixtQkFBbUIsQ0FBQyxJQUFJLENBQ3pCLENBQUM7WUFDRixNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekMsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFF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