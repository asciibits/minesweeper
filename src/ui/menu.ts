interface ConfigState {
  colorPalette?: 'SYSTEM' | 'LIGHT' | 'DARK';
  width?: string;
  height?: string;
  mineCount?: string;
  initialClick?: 'NO_MINE' | 'ZERO' | 'ANY';
}

export function initMenus(window: Window) {
  const boardMenu = window.document.getElementById(
    'board_menu',
  ) as HTMLInputElement;
  const expertPreset = window.document.getElementById(
    'expert_preset',
  ) as HTMLInputElement;
  const beginnerPreset = window.document.getElementById(
    'beginner_preset',
  ) as HTMLInputElement;
  const intermediatePreset = window.document.getElementById(
    'intermediate_preset',
  ) as HTMLInputElement;

  const widthElement = window.document.getElementById(
    'width',
  ) as HTMLInputElement;
  const heightElement = window.document.getElementById(
    'height',
  ) as HTMLInputElement;
  const mineCountElement = window.document.getElementById(
    'mines',
  ) as HTMLInputElement;

  function updateDimensions(
    width: string,
    height: string,
    mineCount: string,
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
    setPresetActive();
    saveState();
    return changed;
  }
  expertPreset.addEventListener('click', () => {
    if (updateDimensions('30', '16', '99')) {
      // pick one to change
      boardMenu.dispatchEvent(new Event('change'));
    }
  });
  intermediatePreset.addEventListener('click', () => {
    if (updateDimensions('16', '16', '40')) {
      // pick one to change
      boardMenu.dispatchEvent(new Event('change'));
    }
  });
  beginnerPreset.addEventListener('click', () => {
    if (updateDimensions('9', '9', '10')) {
      // pick one to change
      boardMenu.dispatchEvent(new Event('change'));
    }
  });
  function setPresetActive() {
    const width = widthElement.value;
    const height = heightElement.value;
    const mineCount = mineCountElement.value;

    let activeButton: HTMLElement | undefined = undefined;
    if (height === '16' && width === '30' && mineCount === '99') {
      activeButton = expertPreset;
    } else if (height === '16' && width === '16' && mineCount === '40') {
      activeButton = intermediatePreset;
    } else if (height === '9' && width === '9' && mineCount === '10') {
      activeButton = beginnerPreset;
    }
    [expertPreset, intermediatePreset, beginnerPreset].forEach(e => {
      e.classList.toggle('active', activeButton === e);
    });
  }
  [widthElement, heightElement, mineCountElement].forEach(e =>
    e.addEventListener('change', () => {
      setPresetActive();
    }),
  );

  const body = window.document.getElementsByTagName('body')[0];
  const systemColor = window.document.getElementById(
    'system_color',
  ) as HTMLInputElement;
  const lightColor = window.document.getElementById(
    'light_color',
  ) as HTMLInputElement;
  const darkColor = window.document.getElementById(
    'dark_color',
  ) as HTMLInputElement;

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

  boardMenu.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      (window.document.activeElement as HTMLElement)?.blur?.();
    }
  });

  const noMineElement = window.document.getElementById(
    'no_mine',
  ) as HTMLInputElement;
  const openAreaElement = window.document.getElementById(
    'open_area',
  ) as HTMLInputElement;
  const minePossibleElement = window.document.getElementById(
    'mine_possible',
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

  function getSettings(): ConfigState {
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
    return {colorPalette, width, height, mineCount, initialClick};
  }

  function setSettings(configState?: ConfigState | null) {
    switch (configState?.colorPalette) {
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
      default: // 'SYSTEM'
        if (!systemColor.checked) {
          systemColor.checked = true;
          systemColor.dispatchEvent(new Event('click'));
        }
        break;
    }
    switch (configState?.initialClick) {
      case 'ZERO':
        openAreaElement.checked = true;
        break;
      case 'ANY':
        minePossibleElement.checked = true;
        break;
      default: // 'NO_MINE'
        noMineElement.checked = true;
        break;
    }
    updateDimensions(
      configState?.width ?? '30',
      configState?.height ?? '16',
      configState?.mineCount ?? '99',
    );
  }

  const settings = JSON.parse(
    localStorage?.getItem('settings') ?? 'null',
  ) as ConfigState | null;
  setSettings(settings);

  function saveState() {
    const settings = JSON.stringify(getSettings());
    if (localStorage) {
      localStorage.setItem('settings', settings);
    }
  }
}
