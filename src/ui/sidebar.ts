const win: Window | undefined =
  typeof window === 'undefined' ? undefined : window;

interface SidebarState {
  colorPalette?: 'SYSTEM' | 'LIGHT' | 'DARK';
  width?: string;
  height?: string;
  mineCount?: string;
  initialClick?: 'NO_MINE' | 'ZERO' | 'ANY';
}

if (win) {
  win.addEventListener('load', () => {
    const expertChip = document.getElementById(
      'expert_chip'
    ) as HTMLInputElement;
    const beginnerChip = document.getElementById(
      'beginner_chip'
    ) as HTMLInputElement;
    const intermediateChip = document.getElementById(
      'intermediate_chip'
    ) as HTMLInputElement;
    const customChip = document.getElementById(
      'custom_chip'
    ) as HTMLInputElement;

    const widthElement = document.getElementById('width') as HTMLInputElement;
    const heightElement = document.getElementById('height') as HTMLInputElement;
    const mineCountElement = document.getElementById(
      'mine_count'
    ) as HTMLInputElement;

    function updateDimensions(
      width: string,
      height: string,
      mineCount: string
    ): boolean {
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
    [widthElement, heightElement, mineCountElement].forEach(e =>
      e.addEventListener('change', () => {
        const width = widthElement.value;
        const height = heightElement.value;
        const mineCount = mineCountElement.value;

        if (height === '16' && width === '30' && mineCount === '99') {
          expertChip.checked = true;
        } else if (height === '16' && width === '16' && mineCount === '40') {
          intermediateChip.checked = true;
        } else if (height === '9' && width === '9' && mineCount === '10') {
          beginnerChip.checked = true;
        } else {
          customChip.checked = true;
        }
      })
    );

    const body = document.getElementsByTagName('body')[0];
    const systemColor = document.getElementById(
      'system_color'
    ) as HTMLInputElement;
    const lightColor = document.getElementById(
      'light_color'
    ) as HTMLInputElement;
    const darkColor = document.getElementById('dark_color') as HTMLInputElement;

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

    const noMineElement = document.getElementById(
      'no_mine'
    ) as HTMLInputElement;
    const openAreaElement = document.getElementById(
      'open_area'
    ) as HTMLInputElement;
    const minePossibleElement = document.getElementById(
      'mine_possible'
    ) as HTMLInputElement;

    noMineElement.addEventListener('change', () => {
      saveState();
    });
    openAreaElement.addEventListener('change', () => {
      saveState();
    });
    minePossibleElement.addEventListener('change', () => {
      saveState();
    });

    function getSettings(): SidebarState {
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

    function setSettings(sidebarState?: SidebarState) {
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
        updateDimensions(
          sidebarState.width ?? '30',
          sidebarState.height ?? '16',
          sidebarState.mineCount ?? '99'
        );
      }
    }

    const settings = JSON.parse(
      localStorage?.getItem('settings') ?? 'null'
    ) as SidebarState | null;
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
