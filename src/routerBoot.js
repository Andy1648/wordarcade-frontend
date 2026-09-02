// routerBoot.js — side-effect module: run the path->query bridge ONCE, at import time, BEFORE any
// entry-param reader (LAUNCH_INTENT / solo/config / cg/cgEntry / satRush/config) evaluates. main.jsx
// imports this FIRST so a clean path like /sat-rush is translated to the query those readers expect.
import { bridgePathToSearch } from './router';

bridgePathToSearch();
