import { assert } from './assert.js';
/** Calculate nCk - ie n!/(k!*(n-k)!) */
export function combinations(n, k) {
    assert(k <= n && n >= 0 && k >= 0);
    // use n-k if it's smaller than k; it yields the same result with fewer
    // // operations
    if (n - k < k) {
        k = n - k;
    }
    // short circuit for zero - it doesn't play well with the optimization below
    if (k === 0) {
        return 1n;
    }
    // To keep the values within reasonable range, arrange as alternating
    // multiplication and division. For example, 9C4 -> (9*8*7*6)/(4*3*2*1), is
    // rearranged to 9 / 1 * 8 / 2 * 7 / 3 * 6 / 2. Here  each step is guaranteed
    // to be an exact integer. Also, we skip the divide-by-one step.
    let c = BigInt(n);
    for (let m = c - 1n, l = 2n; l <= k; m--, l++) {
        c *= m;
        c /= l;
    }
    return c;
}
/**
 * If val is a bitmap of length n, with m bits set, then this method will return
 * the lexical ordering of val within the set of all possible such bitmaps.
 *
 * This is an O(n^2) operation, assuming bigint calculations on a value with
 * bitlength n is O(n)
 */
export function lexicalOrdering(val, n) {
    assert(val >= 0, 'val must be positive');
    assert(n > 0, 'n must be positive');
    let lexical = 0n;
    let choices = 1n;
    let count = 0n;
    let marked = 0n;
    for (let i = 0; i < n; i++, val >>= 1n) {
        if (val & 1n) {
            lexical -= choices;
            choices *= ++count;
            choices /= ++marked;
            lexical += choices;
        }
        else {
            choices *= ++count;
            choices /= count - marked;
        }
    }
    assert(val === 0n, 'val out of range');
    return lexical;
}
/**
 * This is the inverse of the `lexicalOrdering` function. Return the bitmap of
 * size n with k bits set that is in the given lexical ordering.
 *
 * This is an O(n^2) operation, assuming bigint calculations on a value with
 * bitlength n is O(n)
 */
export function bitmapFromLexicalOrdering(lexical, n, k) {
    let choices = combinations(n, k);
    assert(lexical >= 0n && lexical < choices, 'BoardNumber out of range');
    let count = BigInt(n);
    let marked = BigInt(k);
    let bitmap = 0n;
    for (let i = 0; i < n; i++) {
        bitmap <<= 1n;
        const nextChoiceIfNotSet = (choices * (count - marked)) / count;
        if (lexical < nextChoiceIfNotSet) {
            // not set
            choices = nextChoiceIfNotSet;
        }
        else {
            // set
            bitmap |= 1n;
            lexical -= choices;
            choices *= marked--;
            choices /= count;
            lexical += choices;
        }
        count--;
    }
    return bitmap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tYmluaXRvcmljcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL2NvbWJpbml0b3JpY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUVyQyx3Q0FBd0M7QUFDeEMsTUFBTSxVQUFVLFlBQVksQ0FBQyxDQUFTLEVBQUUsQ0FBUztJQUMvQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNuQyx1RUFBdUU7SUFDdkUsZ0JBQWdCO0lBQ2hCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUNkLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ1osQ0FBQztJQUNELDRFQUE0RTtJQUM1RSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNaLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUNELHFFQUFxRTtJQUNyRSwyRUFBMkU7SUFDM0UsNkVBQTZFO0lBQzdFLGdFQUFnRTtJQUNoRSxJQUFJLENBQUMsR0FBVyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzlDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDUCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1QsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsR0FBVyxFQUFFLENBQVM7SUFDcEQsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztJQUN6QyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBRXBDLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNqQixJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakIsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO0lBQ2YsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBRWhCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxLQUFLLEVBQUUsRUFBRSxDQUFDO1FBQ3ZDLElBQUksR0FBRyxHQUFHLEVBQUUsRUFBRSxDQUFDO1lBQ2IsT0FBTyxJQUFJLE9BQU8sQ0FBQztZQUNuQixPQUFPLElBQUksRUFBRSxLQUFLLENBQUM7WUFDbkIsT0FBTyxJQUFJLEVBQUUsTUFBTSxDQUFDO1lBQ3BCLE9BQU8sSUFBSSxPQUFPLENBQUM7UUFDckIsQ0FBQzthQUFNLENBQUM7WUFDTixPQUFPLElBQUksRUFBRSxLQUFLLENBQUM7WUFDbkIsT0FBTyxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUM7UUFDNUIsQ0FBQztJQUNILENBQUM7SUFDRCxNQUFNLENBQUMsR0FBRyxLQUFLLEVBQUUsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQ3ZDLE9BQWUsRUFDZixDQUFTLEVBQ1QsQ0FBUztJQUVULElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDakMsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLElBQUksT0FBTyxHQUFHLE9BQU8sRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0lBRXZFLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QixJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFdkIsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBRWhCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUMzQixNQUFNLEtBQUssRUFBRSxDQUFDO1FBQ2QsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLE9BQU8sR0FBRyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUNoRSxJQUFJLE9BQU8sR0FBRyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2pDLFVBQVU7WUFDVixPQUFPLEdBQUcsa0JBQWtCLENBQUM7UUFDL0IsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNO1lBQ04sTUFBTSxJQUFJLEVBQUUsQ0FBQztZQUNiLE9BQU8sSUFBSSxPQUFPLENBQUM7WUFDbkIsT0FBTyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ3BCLE9BQU8sSUFBSSxLQUFLLENBQUM7WUFDakIsT0FBTyxJQUFJLE9BQU8sQ0FBQztRQUNyQixDQUFDO1FBQ0QsS0FBSyxFQUFFLENBQUM7SUFDVixDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyJ9