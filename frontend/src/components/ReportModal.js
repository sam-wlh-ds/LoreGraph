import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';  // <--- added axios import
import './reportModal.css';

/* safely parse llm_response */
const parseLLM = (resp) => {
    try {
        const raw = resp.llm_response?.replace(/```json|```/g, '') || '{}';
        return JSON.parse(raw);
    } catch {
        return null;
    }
};


export const ReportModal = ({ open, onClose, apiResp, count, setCount }) => {
    if (!open || !apiResp) return null;
    const rep = parseLLM(apiResp);
    if (!rep) return null;

    const pct = Math.min(Math.max(rep.contradiction_score ?? 0, 0), 100);

    const handleCommit = async () => {
        try {
            console.log("Sending count:", count);  // Debug line
            const response = await axios.post('http://localhost:5000/commit/commit', { count });
            console.log('Commit successful:', response.data);
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
                <button className="commit-btn" onClick={handleCommit}>Commit to Story</button>
                <h1>{count}</h1>
            </div>
        </div>,
        document.body
    );
};
