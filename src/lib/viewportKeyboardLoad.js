// The lazy door to the phone keyboard (main.jsx imports this on the first field focus on a touch screen): the watcher + every
// keyboard rule arrive together, and none of it is in the first paint. Kept apart from viewportKeyboard.js so its unit test needs no CSS.
import './viewportKeyboard.css';
import { installViewportKeyboard } from './viewportKeyboard';

export default (seedTall) => installViewportKeyboard(window, seedTall);
