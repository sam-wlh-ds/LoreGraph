import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { CreateStory } from './pages/CreateStory';
import { MyStories } from './pages/MyStories';
import { StoryDetail } from './pages/StoryDetail';
import { Settings } from './pages/Settings';
import { Logout } from './pages/Logout';
import KnowledgeGraph from './pages/KnowledgeGraph';

function App() {
  const [stories, setStories] = useState([]);

  // Fetch stories from MongoDB on mount
  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await fetch('http://localhost:5000/stories');
        if (response.ok) {
          const data = await response.json();
          setStories(data);
        }
      } catch (err) {
        console.error("Failed to fetch stories from MongoDB:", err);
      }
    };
    fetchStories();
  }, []);

  return (
    <div className="app">
      <Router>
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/createstory" element={<CreateStory stories={stories} setStories={setStories} />} />
            <Route path="/mystories" element={<MyStories stories={stories} setStories={setStories} />} />
            <Route path="/mystories/:storyName" element={<StoryDetail stories={stories} />} />
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
