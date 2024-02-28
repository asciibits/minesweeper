const win = typeof window === 'undefined' ? undefined : window;
if (win) {
    win.addEventListener('load', () => {
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
            saveState();
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
            saveState();
        });
        lightColor.addEventListener('click', () => {
            body.classList.remove('dark');
            body.classList.add('light');
            saveState();
        });
        darkColor.addEventListener('click', () => {
            body.classList.remove('light');
            body.classList.add('dark');
            saveState();
        });
        const noMineElement = document.getElementById('no_mine');
        const openAreaElement = document.getElementById('open_area');
        const minePossibleElement = document.getElementById('mine_possible');
        noMineElement.addEventListener('change', () => {
            saveState();
        });
        openAreaElement.addEventListener('change', () => {
            saveState();
        });
        minePossibleElement.addEventListener('change', () => {
            saveState();
        });
        function getSettings() {
            const colorPalette = darkColor.checked
                ? 'DARK'
                : lightColor.checked
                    ? 'LIGHT'
                    : 'SYSTEM';
            const width = widthElement.value;
            const height = heightElement.value;
            const mineCount = mineCountElement.value;
            const initialClick = openAreaElement.checked
                ? 'ZERO'
                : minePossibleElement.checked
                    ? 'ANY'
                    : 'NO_MINE';
            return { colorPalette, width, height, mineCount, initialClick };
        }
        function setSettings(sidebarState) {
            if (sidebarState) {
                switch (sidebarState.colorPalette) {
                    case 'DARK':
                        if (!darkColor.checked) {
                            darkColor.checked = true;
                            darkColor.dispatchEvent(new Event('click'));
                        }
                        break;
                    case 'LIGHT':
                        if (!lightColor.checked) {
                            lightColor.checked = true;
                            lightColor.dispatchEvent(new Event('click'));
                        }
                        break;
                    case 'SYSTEM':
                        if (!systemColor.checked) {
                            systemColor.checked = true;
                            systemColor.dispatchEvent(new Event('click'));
                        }
                        break;
                }
                switch (sidebarState.initialClick) {
                    case 'NO_MINE':
                        noMineElement.checked = true;
                        break;
                    case 'ZERO':
                        openAreaElement.checked = true;
                        break;
                    case 'ANY':
                        minePossibleElement.checked = true;
                        break;
                }
                updateDimensions(sidebarState.width ?? '30', sidebarState.height ?? '16', sidebarState.mineCount ?? '99');
            }
        }
        const settings = JSON.parse(localStorage?.getItem('settings') ?? 'null');
        if (settings) {
            setSettings(settings);
            widthElement.dispatchEvent(new Event('change'));
        }
        function saveState() {
            const settings = JSON.stringify(getSettings());
            if (localStorage) {
                localStorage.setItem('settings', settings);
            }
        }
    });
}
export {};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkZWJhci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91aS9zaWRlYmFyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sR0FBRyxHQUNQLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFVckQsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNSLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFO1FBQ2hDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQ3hDLGFBQWEsQ0FDTSxDQUFDO1FBQ3RCLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQzFDLGVBQWUsQ0FDSSxDQUFDO1FBQ3RCLE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FDOUMsbUJBQW1CLENBQ0EsQ0FBQztRQUN0QixNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUN4QyxhQUFhLENBQ00sQ0FBQztRQUV0QixNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBcUIsQ0FBQztRQUMxRSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBcUIsQ0FBQztRQUM1RSxNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQzlDLFlBQVksQ0FDTyxDQUFDO1FBRXRCLFNBQVMsZ0JBQWdCLENBQ3ZCLEtBQWEsRUFDYixNQUFjLEVBQ2QsU0FBaUI7WUFFakIsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDO1lBQ3BCLElBQUksWUFBWSxDQUFDLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDakMsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDZixZQUFZLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztZQUM3QixDQUFDO1lBQ0QsSUFBSSxhQUFhLENBQUMsS0FBSyxL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