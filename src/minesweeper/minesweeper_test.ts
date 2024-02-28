import { combinations } from '../util/combinitorics.js';
import { MineField, OpeningRestrictions, Position } from './minesweeper.js';

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
          } else {
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
          } else {
            expect(field.getCellValue(x, y)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
    it('throws if the same cell is marked as a bomb twice', () => {
      expect(
        () =>
          new MineField(4, 3, [
            { x: 1, y: 2 },
            { x: 1, y: 2 },
          ]),
      ).toThrow();
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
      expect(
        MineField.createMineFieldWithBoardNumber(
          field.width,
          field.height,
          field.mineCount,
          field.getBoardNumber(),
        ).toString(),
      ).toBe(field.toString());
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
          if (field.getCellValue(x, y) < 0) bombCount++;
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
      const field = MineField.createRandomMineFieldWithOpening(
        4,
        3,
        2,
        { x: 2, y: 1 },
        OpeningRestrictions.ZERO,
      );
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

//       // // make sure the minemap is able to be recreated from the mineModeSet
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
function minefield(...rows: string[]): MineField {
  rows = rows
    .flatMap(r => r.split('\n'))
    .map(r => r.trim())
    .filter(r => !!r);
  const height = rows.length;
  let width = 0;
  const bombCells: Position[] = [];
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
