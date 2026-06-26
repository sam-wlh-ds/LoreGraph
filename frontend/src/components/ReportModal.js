import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';  // <--- added axios import
import './reportModal.css';

/* safely parse llm_response */
const parseLLM = (resp) => {
    if (!resp) return null;
    // Handle pre-parsed report from database
    if (resp.report && typeof resp.report === 'object') {
        return resp.report;
    }
    // Handle raw string from API parse
    try {
        const raw = resp.llm_response?.replace(/```json|```/g, '') || '{}';
        return JSON.parse(raw);
    } catch {
        return null;
    }
};


export const ReportModal = ({ open, onClose, apiResp, count, setCount, setStories, storyName, fileName, hideCommit = false }) => {
    if (!open || !apiResp) return null;
    const rep = parseLLM(apiResp);
    if (!rep) return null;

    const pct = Math.min(Math.max(rep.contradiction_score ?? 0, 0), 100);

    const handleCommit = async () => {
        try {
            console.log("Sending count:", count);  // Debug line
            const response = await axios.post('http://localhost:5000/commit/commit', { count });
            console.log('Commit successful:', response.data);

            // Update React stories state and persist to MongoDB
            if (setStories && storyName) {
                const scriptTitle = apiResp?.title;
                setStories(prevStories => {
                    return prevStories.map(s => {
                        if (s.name === storyName) {
                            const updatedStory = {
                                ...s,
                                files: [...(s.files || []), { name: fileName, title: scriptTitle, date: new Date().toLocaleDateString() }],
                                lastModified: new Date().toLocaleDateString()
                            };

                            // Sync the updated story files list to MongoDB
                            fetch('http://localhost:5000/stories', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(updatedStory)
                            }).catch(err => console.error("Failed to sync story update to MongoDB:", err));

                            return updatedStory;
                        }
                        return s;
                    });
                });
            }
        } catch (error) {
            if (error.response) {
                console.error('Server error:', error.response.statusText);
            } else {
                console.error('Network error:', error.message);
            }
        }
    
        setCount(count + 1);
    };
    

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>✕</button>

                <h2>Story Canon‑Check Report</h2>

                <p className="rep-summary">{rep.summary}</p>

                <div className="rep-score-box">
                    <span>Contradiction Score</span>
                    <div className="rep-bar">
                        <div style={{ width: `${pct}%` }} />
                    </div>
                    <span>{pct}</span>
                </div>

                <h3>Why it contradicts MCU</h3>
                <ul>{rep.justification.map((j, i) => <li key={i}>{j}</li>)}</ul>

                <h3>Recommendations</h3>
                <ul className="rec">{rep.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>

                {/* Commit button triggers POST request */}
                {!hideCommit && (
                    <>
                        <button className="commit-btn" onClick={handleCommit}>Commit to Story</button>
                        <h1>{count}</h1>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
