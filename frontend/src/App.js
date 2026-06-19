import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { CreateStory } from './pages/CreateStory';
import { MyStories } from './pages/MyStories';
import { Settings } from './pages/Settings';
import { Logout } from './pages/Logout';
import KnowledgeGraph from './pages/KnowledgeGraph';

function App() {
  const [stories, setStories] = useState([]); // Initialize stories state as an empty array

  return (
    <div className="app">
      <Router>
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/createstory" element={<CreateStory setStories={setStories} />} />
            <Route path="/mystories" element={<MyStories stories={stories} />} />
            <Route path="/knowledgegraph" element={<KnowledgeGraph />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logout" element={<Logout />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}

export default App;
