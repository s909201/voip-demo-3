import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CallView from './views/CallView';
import MonitorPage from './pages/MonitorPage';
import CallHistoryPage from './pages/CallHistoryPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CallView />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/history" element={<CallHistoryPage />} />
      </Routes>
    </Router>
  );
}

export default App;
