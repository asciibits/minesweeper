import {initUi} from './ui.js';

/** @fileoverview The master export file */
const win: Window | undefined =
  typeof window === 'undefined' ? undefined : window;

if (win) {
  initUi(win);
}
