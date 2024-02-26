const win: Window | undefined =
  typeof window === 'undefined' ? undefined : window;

if (win) {
  const sideBar = document.getElementById('sidebar') as HTMLFieldSetElement;

  const expertChip = document.getElementById('expert_chip') as HTMLInputElement;
  const beginnerChip = document.getElementById(
    'beginner_chip'
  ) as HTMLInputElement;
  const intermediateChip = document.getElementById(
    'intermediate_chip'
  ) as HTMLInputElement;
  const customChip = document.getElementById('custom_chip') as HTMLInputElement;

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
    } else if (height === '16' && width === '16' && mineCount === '40') {
      intermediateChip.checked = true;
    } else if (height === '9' && width === '9' && mineCount === '10') {
      beginnerChip.checked = true;
    } else {
      customChip.checked = true;
    }
  }))
}
