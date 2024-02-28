import { initSideBar } from './sidebar.js';
import { initUi } from './ui.js';
/** @fileoverview The master export file */
const win = typeof window === 'undefined' ? undefined : window;
if (win) {
    initSideBar(win);
    initUi(win);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdWkvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUN6QyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRS9CLDJDQUEyQztBQUMzQyxNQUFNLEdBQUcsR0FDUCxPQUFPLE1BQU0sS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBRXJELElBQUksR0FBRyxFQUFFLENBQUM7SUFDUixXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2QsQ0FBQyJ9