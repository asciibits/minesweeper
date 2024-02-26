import { BitSourceReader, biterator } from '../util/io.js';
import { KnownBoardInfo, FlagMode, OpenState } from './minesweeper_storage.js';

export interface Stats {
  openStats: OpenStats;
}

export interface OpenStats {
  open: number;
  count: number;
  fullFlagSummary?: StyleStatsSummary;
  noFlagSummary?: StyleStatsSummary;
  efficiencyFlagSummary?: StyleStatsSummary;
  fullFlagStats?: StyleStats;
  noFlagStats?: StyleStats;
}

/**
 * Below "neighbor" refers to a known directly adjacent (i.e. not diagonal)
 * neighbor from earlier in the stream. Effectively, this means either the cell
 * to the left, or the cell above (since right and below haven't been streamed
 * yet
 */
export interface StyleStats {
  /** How many cells have two known neighbors */
  twoNeighborCount: number;

  /**
   * Of the cells with two neighbors, how many of them have matching neighbors
   */
  twoNeighborMatch: number;

  /**
   * The number of cells with two matching neighbors whose status matches theirs
   */
  matchBothNeighbors: number;

  /**
   * The number of cells with mixed neighbors that are open
   */
  openWithMixedNeighbors: number;

  /** The number of cells with a sigle neighbor */
  oneNeighborCount: number;

  /** The number of cells with a sigle neighbor whose status matches */
  matchOnlyNeighbor: number;

  /** The number of cells with no neighbors */
  noNeighborCount: number;

  /** The number of cells with no neighbors that are open */
  openWithNoNeighbors: number;

  /**
   * The number of cells that are ignored, and do not contribute to any of the
   * above stats
   */
  ignored: number;

  /** The number of ignored cells that are open */
  openWithIgnored: number;
}

export interface StyleStatsSummary {
  /** matchBothNeighbors / twoNeighborMatch */
  matchBothProbability: number;

  /**
   * openWithMixedNeighbors / (twoNeighborCount - twoNeighborMatch)
   */
  openWithMixedProbability: number;

  /** matchOnlyNeighbor / oneNeighborCount */
  matchOnlyProbability: number;

  /** openWithNoNeighbors / noNeighborCount */
  openWithNoProbability: number;

  /** openWithIgnored / ignored */
  openWithIgnoredProbability: number;

  /** openWithIgnored / ignored */
  compressedSize: number;
}

/**
 * This is a very expensive operation, best not to call it from the UI thread
 */
export function getStats(boardInfo: KnownBoardInfo): Stats {
  const openStats = {
    open: 0,
    count: 0,
    fullFlagSummary: undefined,
    noFlagSummary: undefined,
    efficiencyFlagSummary: undefined,
    fullFlagStats: {
      twoNeighborCount: 0,
      twoNeighborMatch: 0,
      matchBothNeighbors: 0,
      openWithMixedNeighbors: 0,
      oneNeighborCount: 0,
      matchOnlyNeighbor: 0,
      noNeighborCount: 0,
      openWithNoNeighbors: 0,
      ignored: 0,
      openWithIgnored: 0,
    },
    noFlagStats: {
      twoNeighborCount: 0,
      twoNeighborMatch: 0,
      matchBothNeighbors: 0,
      openWithMixedNeighbors: 0,
      oneNeighborCount: 0,
      matchOnlyNeighbor: 0,
      noNeighborCount: 0,
      openWithNoNeighbors: 0,
      ignored: 0,
      openWithIgnored: 0,
    },
  } as OpenStats;

  const { width, height, cellData } = boardInfo;
  const cellCount = width * height;

  function getIndex(x: number, y: number): number {
    return y * width + x;
  }

  function isOpen(idx: number): boolean {
    return cellData[idx].openState === OpenState.OPENED;
  }

  function isMine(idx: number): boolean {
    return cellData[idx].isMine;
  }

  function isFlag(idx: number): boolean {
    return cellData[idx].openState === OpenState.FLAGGED;
  }

  function isUnflaggedMine(idx: number) {
    return !isFlag(idx) && isMine(idx);
  }

  function isOpenOrFlag(idx: number): boolean {
    return isOpen(idx) || isFlag(idx);
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      openStats.count++;

      const cell = getIndex(x, y);
      const upCell = y > 0 ? cell - width : undefined;
      const leftCell = x > 0 ? cell - 1 : undefined;

      const open = isOpenOrFlag(cell);
      if (open) {
        openStats.open++;
      }

      const updateStats = (
        stats: StyleStats,
        countCell: (idx: number) => boolean = () => true
      ) => {
        if (!countCell(cell)) {
          stats.ignored++;
          if (open) {
            stats.openWithIgnored++;
          }
          return;
        }
        const neighbors =
          (upCell && countCell(upCell) ? 1 : 0) +
          (leftCell && countCell(leftCell) ? 1 : 0);
        const neighborsOpen =
          (upCell && countCell(upCell) && isOpenOrFlag(upCell) ? 1 : 0) +
          (leftCell && countCell(leftCell) && isOpenOrFlag(leftCell) ? 1 : 0);
        switch (neighbors) {
          case 2:
            stats.twoNeighborCount++;
            if (neighborsOpen != 1) {
              stats.twoNeighborMatch++;
              if ((neighborsOpen === 2) === open) {
                stats.matchBothNeighbors++;
              }
            } else if (open) {
              stats.openWithMixedNeighbors++;
            }
            break;
          case 1:
            stats.oneNeighborCount++;
            if ((neighborsOpen === 1) === open) {
              stats.matchOnlyNeighbor++;
            }
            break;
          default:
            stats.noNeighborCount++;
            if (open) {
              stats.openWithNoNeighbors++;
            }
        }
      };

      updateStats(openStats.fullFlagStats!);
      updateStats(openStats.noFlagStats!, (c: number) => !isUnflaggedMine(c));
    }
  }

  const openMapReader = new BitSourceReader(
    cellData.map(c => ({
      value: c.openState === OpenState.OPENED ? 1 : 0,
      bitCount: 1,
    })),
    cellCount
  );

  function summarize(
    stats: StyleStats,
    flagMode = FlagMode.FULL_FLAG
  ): StyleStatsSummary {
    const {
      matchBothNeighbors,
      twoNeighborMatch,
      openWithMixedNeighbors,
      twoNeighborCount,
      matchOnlyNeighbor,
      oneNeighborCount,
      openWithNoNeighbors,
      noNeighborCount,
      openWithIgnored,
      ignored,
    } = stats;
    const matchBothProbability = matchBothNeighbors / twoNeighborMatch;
    const openWithMixedProbability =
      openWithMixedNeighbors / (twoNeighborCount - twoNeighborMatch);

    const matchOnlyProbability = matchOnlyNeighbor / oneNeighborCount;

    const openWithNoProbability = openWithNoNeighbors / noNeighborCount;

    const openWithIgnoredProbability = openWithIgnored / ignored;

    const compressedSize = 0;
    // [
    //   ...biterator(
    //     new OldArithmeticCoder(
    //       new OpenBoardModel(
    //         width,
    //         flagMode,
    //         cellData.map(c => c.isMine)
    //       ),
    //       false
    //     )
    //       .encode(openMapReader)
    //       .toReader()
    //   ),
    // ].length;

    return {
      matchBothProbability,
      openWithMixedProbability,
      matchOnlyProbability,
      openWithNoProbability,
      openWithIgnoredProbability,
      compressedSize,
    };
  }

  openStats.fullFlagSummary = summarize(openStats.fullFlagStats!);
  openStats.noFlagSummary = summarize(openStats.noFlagStats!, FlagMode.NO_FLAG);
  openStats.efficiencyFlagSummary = summarize(
    openStats.noFlagStats!,
    FlagMode.EFFICIENCY
  );

  // openMapIterator.reset();
  // const compressedNoFlagSize = encodeArithmetic(
  //   openMapIterator,
  //   new OpenBoardModel(width, openMapIterator, true)
  // ).bitset.length;
  // openMapIterator.reset();
  // const gridEncodeSize = encodeGrid(openMapIterator, width).bitset.length;

  return { openStats };
}
