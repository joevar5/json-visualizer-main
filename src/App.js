import './App.css';

import Home from './Home/Home.jsx';
import OnboardingModal from './components/Onboarding/OnboardingModal';

function App() {
  return (
    <div className="App">
      <OnboardingModal />
      <Home />
    </div>
  );
}

export default App;
