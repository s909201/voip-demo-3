import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CallView from './views/CallView';
import MonitorPage from './pages/MonitorPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CallView />} />
        <Route path="/monitor" element={<MonitorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
