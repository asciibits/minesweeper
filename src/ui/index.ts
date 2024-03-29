import {initUi} from './minesweeper_ui.js';

/** @fileoverview The master export file */
const win: Window | undefined =
  typeof window === 'undefined' ? undefined : window;

if (win) {
  win.addEventListener('load', () => {
    initUi(win);
  });
}
