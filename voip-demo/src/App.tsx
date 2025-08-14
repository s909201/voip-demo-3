import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import CallView from './views/CallView';
import MonitorPage from './pages/MonitorPage';
import CallHistoryPage from './pages/CallHistoryPage';

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<CallView />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/history" element={<CallHistoryPage />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
