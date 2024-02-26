const win = typeof window === 'undefined' ? undefined : window;
if (win) {
    const expertChip = document.getElementById('expert_chip');
    const beginnerChip = document.getElementById('beginner_chip');
    const intermediateChip = document.getElementById('intermediate_chip');
    const customChip = document.getElementById('custom_chip');
    const widthElement = document.getElementById('width');
    const heightElement = document.getElementById('height');
    const mineCountElement = document.getElementById('mine_count');
    function updateDimensions(width, height, mineCount) {
        let changed = false;
        if (widthElement.value !== width) {
            changed = true;
            widthElement.value = width;
        }
        if (heightElement.value !== height) {
            changed = true;
            heightElement.value = height;
        }
        if (mineCountElement.value !== mineCount) {
            changed = true;
            mineCountElement.value = mineCount;
        }
        return changed;
    }
    expertChip.addEventListener('click', () => {
        if (updateDimensions('30', '16', '99')) {
            // pick one to change
            widthElement.dispatchEvent(new Event('change'));
        }
    });
    intermediateChip.addEventListener('click', () => {
        if (updateDimensions('16', '16', '40')) {
            // pick one to change
            widthElement.dispatchEvent(new Event('change'));
        }
    });
    beginnerChip.addEventListener('click', () => {
        if (updateDimensions('9', '9', '10')) {
            // pick one to change
            widthElement.dispatchEvent(new Event('change'));
        }
    });
    [widthElement, heightElement, mineCountElement].forEach(e => e.addEventListener('change', () => {
        const width = widthElement.value;
        const height = heightElement.value;
        const mineCount = mineCountElement.value;
        if (height === '16' && width === '30' && mineCount === '99') {
            expertChip.checked = true;
        }
        else if (height === '16' && width === '16' && mineCount === '40') {
            intermediateChip.checked = true;
        }
        else if (height === '9' && width === '9' && mineCount === '10') {
            beginnerChip.checked = true;
        }
        else {
            customChip.checked = true;
        }
    }));
    const body = document.getElementsByTagName('body')[0];
    const systemColor = document.getElementById('system_color');
    const lightColor = document.getElementById('light_color');
    const darkColor = document.getElementById('dark_color');
    systemColor.addEventListener('click', () => {
        body.classList.remove('dark');
        body.classList.remove('light');
    });
    lightColor.addEventListener('click', () => {
        body.classList.remove('dark');
        body.classList.add('light');
    });
    darkColor.addEventListener('click', () => {
        body.classList.remove('light');
        body.classList.add('dark');
    });
}
export {};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkZWJhci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91aS9zaWRlYmFyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sR0FBRyxHQUNQLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFFckQsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNSLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFxQixDQUFDO0lBQzlFLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQzFDLGVBQWUsQ0FDSSxDQUFDO0lBQ3RCLE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FDOUMsbUJBQW1CLENBQ0EsQ0FBQztJQUN0QixNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBcUIsQ0FBQztJQUU5RSxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBcUIsQ0FBQztJQUMxRSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBcUIsQ0FBQztJQUM1RSxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQzlDLFlBQVksQ0FDTyxDQUFDO0lBRXRCLFNBQVMsZ0JBQWdCLENBQ3ZCLEtBQWEsRUFDYixNQUFjLEVBQ2QsU0FBaUI7UUFFakIsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3BCLElBQUksWUFBWSxDQUFDLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQ2YsWUFBWSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDN0IsQ0FBQztRQUNELElBQUksYUFBYSxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNuQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQ2YsYUFBYSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7UUFDL0IsQ0FBQztRQUNELElBQUksZ0JBQWdCLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDZixnQkFBZ0IsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO1FBQ3JDLENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBQ0QsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDeEMsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDdkMscUJBQXFCO1lBQ3JCLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNsRCxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSCxnQkFBZ0IsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO1FBQzlDLElBQUksZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLHFCQUFxQjtZQUNyQixZQUFZLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbEQsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsWUFBWSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDMUMsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDckMscUJBQXFCO1lBQ3JCLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUNsRCxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSCxDQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDMUQsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7UUFDaEMsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQztRQUNqQyxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDO1FBQ25DLE1BQU0sU0FBUyxHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQztRQUV6QyxJQUFJLE1BQU0sS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDNUQsVUFBVSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDNUIsQ0FBQzthQUFNLElBQUksTUFBTSxLQUFLLElBQUksSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNuRSxnQkFBZ0IsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ2xDLENBQUM7YUFBTSxJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxLQUFLLEdBQUcsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDakUsWUFBWSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDOUIsQ0FBQzthQUFNLENBQUM7WUFDTixVQUFVLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUM1QixDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUVGLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0RCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUN6QyxjQUFjLENBQ0ssQ0FBQztJQUN0QixNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBcUIsQ0FBQztJQUM5RSxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBcUIsQ0FBQztJQUU1RSxXQUFXLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtRQUN6QyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5QixJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqQyxDQUFDLENBQUMsQ0FBQztJQUNILFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO1FBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzlCLENBQUMsQ0FBQyxDQUFDO0lBQ0gsU0FBUyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDdkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDN0IsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIn0=