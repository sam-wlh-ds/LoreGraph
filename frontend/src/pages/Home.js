import React from 'react';
import './Home.css';
import '../styles/shared.css';

export const Home = () => {
    return (
        <div className="page-container">
            <div className="home-container">
                <div className="hero-section">
                    <h1>Welcome to Lore Graph</h1>
                    <p className="tagline">Your AI-Powered Marvel Canon Checker</p>
                </div>
                
                <div className="features-section">
                    <div className="feature-card" style={{"--card-index": 0}}>
                        <h2>Canon Verification</h2>
                        <p>Ensure your stories align perfectly with Marvel Universe canon using our advanced AI technology.</p>
                    </div>
                    
                    <div className="feature-card" style={{"--card-index": 1}}>
                        <h2>Knowledge Graph</h2>
                        <p>Access our comprehensive Marvel Universe knowledge graph to verify character relationships and timelines.</p>
                    </div>
                    
                    <div className="feature-card" style={{"--card-index": 2}}>
                        <h2>Story Management</h2>
                        <p>Organize your stories and get instant feedback on MCU compatibility.</p>
                    </div>
                    
                    <div className="feature-card" style={{"--card-index": 3}}>
                        <h2>Real-time Analysis</h2>
                        <p>Get immediate feedback on your stories' alignment with Marvel canon.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


