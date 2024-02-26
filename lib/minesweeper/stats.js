import { BitSourceReader } from '../util/io.js';
import { FlagMode, OpenState } from './minesweeper_storage.js';
/**
 * This is a very expensive operation, best not to call it from the UI thread
 */
export function getStats(boardInfo) {
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
    };
    const { width, height, cellData } = boardInfo;
    const cellCount = width * height;
    function getIndex(x, y) {
        return y * width + x;
    }
    function isOpen(idx) {
        return cellData[idx].openState === OpenState.OPENED;
    }
    function isMine(idx) {
        return cellData[idx].isMine;
    }
    function isFlag(idx) {
        return cellData[idx].openState === OpenState.FLAGGED;
    }
    function isUnflaggedMine(idx) {
        return !isFlag(idx) && isMine(idx);
    }
    function isOpenOrFlag(idx) {
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
            const updateStats = (stats, countCell = () => true) => {
                if (!countCell(cell)) {
                    stats.ignored++;
                    if (open) {
                        stats.openWithIgnored++;
                    }
                    return;
                }
                const neighbors = (upCell && countCell(upCell) ? 1 : 0) +
                    (leftCell && countCell(leftCell) ? 1 : 0);
                const neighborsOpen = (upCell && countCell(upCell) && isOpenOrFlag(upCell) ? 1 : 0) +
                    (leftCell && countCell(leftCell) && isOpenOrFlag(leftCell) ? 1 : 0);
                switch (neighbors) {
                    case 2:
                        stats.twoNeighborCount++;
                        if (neighborsOpen != 1) {
                            stats.twoNeighborMatch++;
                            if ((neighborsOpen === 2) === open) {
                                stats.matchBothNeighbors++;
                            }
                        }
                        else if (open) {
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
            updateStats(openStats.fullFlagStats);
            updateStats(openStats.noFlagStats, (c) => !isUnflaggedMine(c));
        }
    }
    const openMapReader = new BitSourceReader(cellData.map(c => ({
        value: c.openState === OpenState.OPENED ? 1 : 0,
        bitCount: 1,
    })), cellCount);
    function summarize(stats, flagMode = FlagMode.FULL_FLAG) {
        const { matchBothNeighbors, twoNeighborMatch, openWithMixedNeighbors, twoNeighborCount, matchOnlyNeighbor, oneNeighborCount, openWithNoNeighbors, noNeighborCount, openWithIgnored, ignored, } = stats;
        const matchBothProbability = matchBothNeighbors / twoNeighborMatch;
        const openWithMixedProbability = openWithMixedNeighbors / (twoNeighborCount - twoNeighborMatch);
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
    openStats.fullFlagSummary = summarize(openStats.fullFlagStats);
    openStats.noFlagSummary = summarize(openStats.noFlagStats, FlagMode.NO_FLAG);
    openStats.efficiencyFlagSummary = summarize(openStats.noFlagStats, FlagMode.EFFICIENCY);
    // openMapIterator.reset();
    // const compressedNoFlagSize = encodeArithmetic(
    //   openMapIterator,
    //   new OpenBoardModel(width, openMapIterator, true)
    // ).bitset.length;
    // openMapIterator.reset();
    // const gridEncodeSize = encodeGrid(openMapIterator, width).bitset.length;
    return { openStats };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWluZXN3ZWVwZXIvc3RhdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGVBQWUsRUFBYSxNQUFNLGVBQWUsQ0FBQztBQUMzRCxPQUFPLEVBQWtCLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQXFGL0U7O0dBRUc7QUFDSCxNQUFNLFVBQVUsUUFBUSxDQUFDLFNBQXlCO0lBQ2hELE1BQU0sU0FBUyxHQUFHO1FBQ2hCLElBQUksRUFBRSxDQUFDO1FBQ1AsS0FBSyxFQUFFLENBQUM7UUFDUixlQUFlLEVBQUUsU0FBUztRQUMxQixhQUFhLEVBQUUsU0FBUztRQUN4QixxQkFBcUIsRUFBRSxTQUFTO1FBQ2hDLGFBQWEsRUFBRTtZQUNiLGdCQUFnQixFQUFFLENBQUM7WUFDbkIsZ0JBQWdCLEVBQUUsQ0FBQztZQUNuQixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLHNCQUFzQixFQUFFLENBQUM7WUFDekIsZ0JBQWdCLEVBQUUsQ0FBQztZQUNuQixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLG1CQUFtQixFQUFFLENBQUM7WUFDdEIsT0FBTyxFQUFFLENBQUM7WUFDVixlQUFlLEVBQUUsQ0FBQztTQUNuQjtRQUNELFdBQVcsRUFBRTtZQUNYLGdCQUFnQixFQUFFLENBQUM7WUFDbkIsZ0JBQWdCLEVBQUUsQ0FBQztZQUNuQixrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLHNCQUFzQixFQUFFLENBQUM7WUFDekIsZ0JBQWdCLEVBQUUsQ0FBQztZQUNuQixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLG1CQUFtQixFQUFFLENBQUM7WUFDdEIsT0FBTyxFQUFFLENBQUM7WUFDVixlQUFlLEVBQUUsQ0FBQztTQUNuQjtLQUNXLENBQUM7SUFFZixNQUFNLEVBQUUsS0FBSyxFQUFF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