// App.jsx
import Homepage from './components/Homepage';

/**
 * Top-level app component. Deliberately minimal for now - this build's
 * scope is the homepage/lobby grid only. Room flow (create/join screens)
 * and the WebSocket connection to the Chain Reaction backend are future
 * work that will likely introduce routing or simple view-state here.
 */
function App() {
  return <Homepage />;
}

export default App;
