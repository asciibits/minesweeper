export function initSideBar(window) {
    window.addEventListener('load', () => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkZWJhci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91aS9zaWRlYmFyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE1BQU0sVUFBVSxXQUFXLENBQUMsTUFBYztJQUN4QyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNuQyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUN4QyxhQUFhLENBQ00sQ0FBQztRQUN0QixNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsY0FBYyxDQUMxQyxlQUFlLENBQ0ksQ0FBQztRQUN0QixNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQzlDLG1CQUFtQixDQUNBLENBQUM7UUFDdEIsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FDeEMsYUFBYSxDQUNNLENBQUM7UUFFdEIsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQXFCLENBQUM7UUFDMUUsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQXFCLENBQUM7UUFDNUUsTUFBTSxnQkFBZ0IsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUM5QyxZQUFZLENBQ08sQ0FBQztRQUV0QixTQUFTLGdCQUFnQixDQUN2QixLQUFhLEVBQ2IsTUFBYyxFQUNkLFNBQWlCO1lBRWpCLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztZQUNwQixJQUFJLFlBQVksQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ2pDLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ2YsWUFBWSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDN0IsQ0FBQztZQUNELElBQUksYUFBYSxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDbkMsT0FBTyxHQUFHLElBQUksQ0FBQztnQkFDZixhQUFhLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FB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