import React, { useState } from 'react';
import axios from 'axios';
import './RefinementSuggestionCard.css';

/**
 * RefinementSuggestionCard
 * 
 * Displays an interactive AI Plot Revision card system when a narrative contradiction is detected.
 * Fetches 3 canon-compliant plot revisions from the backend /api/analyze/suggest endpoint
 * and presents them in a card-based layout with Apply and Dismiss actions.
 */
export const RefinementSuggestionCard = ({
    scriptId,
    contradictionId,
    contradictionText,
    characterName,
    onApply,
    onDismiss,
    autoOpen = false,
    initialSuggestions = null
}) => {
    const [isOpen, setIsOpen] = useState(autoOpen || !!initialSuggestions);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState(initialSuggestions || []);
    const [appliedIds, setAppliedIds] = useState(new Set());
    const [dismissedIds, setDismissedIds] = useState(new Set());
    const [errorMessage, setErrorMessage] = useState('');

    const fetchSuggestions = async () => {
        setLoading(true);
        setErrorMessage('');
        setIsOpen(true);

        try {
            const payload = {
                script_id: scriptId,
                contradiction_id: contradictionId,
                contradiction_text: contradictionText,
                character: characterName
            };

            const response = await axios.post('http://localhost:5000/api/analyze/suggest', payload);
            
            // Backend returns a JSON array (or object with suggestions key if metadata requested)
            const data = response.data;
            const items = Array.isArray(data) ? data : (data.suggestions || []);

            if (items.length === 0) {
                setErrorMessage('No suggestions were returned. Please try again.');
            } else {
                setSuggestions(items);
                setDismissedIds(new Set());
            }
        } catch (err) {
            console.error('Failed to fetch AI refinement suggestions:', err);
            const msg = err.response?.data?.error || err.message || 'Error generating plot revisions.';
            setErrorMessage(`Failed to get suggestions: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = (suggestion) => {
        setAppliedIds((prev) => {
            const next = new Set(prev);
            if (next.has(suggestion.id)) {
                next.delete(suggestion.id);
            } else {
                next.add(suggestion.id);
            }
            return next;
        });

        if (onApply) {
            onApply(suggestion);
        }
    };

    const handleDismissItem = (id) => {
        setDismissedIds((prev) => new Set(prev).add(id));
    };

    const handleDismissAll = () => {
        setIsOpen(false);
        if (onDismiss) {
            onDismiss();
        }
    };

    // Filter out individually dismissed suggestions
    const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

    // Determine impact badge styling
    const getImpactClass = (impact) => {
        const lower = (impact || '').toLowerCase();
        if (lower.includes('low')) return 'impact-low';
        if (lower.includes('high')) return 'impact-high';
        return 'impact-medium';
    };

    // If panel is closed, show only the "Get AI Suggestions" trigger button
    if (!isOpen) {
        return (
            <div className="refinement-trigger-container">
                <button 
                    type="button" 
                    className="get-suggestions-btn"
                    onClick={fetchSuggestions}
                    title="Generate 3 canon-compliant plot fixes using knowledge graph and AI"
                >
                    <span className="btn-sparkle-icon">✨</span>
                    <span>Get AI Suggestions</span>
                </button>
            </div>
        );
    }

    return (
        <div className="refinement-panel">
            <div className="refinement-panel-header">
                <div className="refinement-panel-title">
                    <span className="sparkle-badge">AI Canon Doctor</span>
                    <h4>Suggested Plot Revisions</h4>
                </div>
                <div className="refinement-header-actions">
                    <button 
                        type="button" 
                        className="panel-refresh-btn" 
                        onClick={fetchSuggestions}
                        disabled={loading}
                        title="Regenerate revisions"
                    >
                        ↻ Refresh
                    </button>
                    <button 
                        type="button" 
                        className="panel-close-btn" 
                        onClick={handleDismissAll}
                        title="Dismiss all suggestions"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {loading && (
                <div className="refinement-loading-state">
                    <div className="refinement-spinner" />
                    <p className="loading-text">
                        Consulting Neo4j timeline graph and constructing canon-compliant plot revisions...
                    </p>
                </div>
            )}

            {errorMessage && !loading && (
                <div className="refinement-error-banner">
                    <p>{errorMessage}</p>
                    <button type="button" className="retry-btn" onClick={fetchSuggestions}>
                        Retry
                    </button>
                </div>
            )}

            {!loading && !errorMessage && visibleSuggestions.length === 0 && (
                <div className="refinement-empty-state">
                    <p>All suggestions dismissed.</p>
                    <button type="button" className="retry-btn" onClick={fetchSuggestions}>
                        Fetch New Suggestions
                    </button>
                </div>
            )}

            {!loading && !errorMessage && visibleSuggestions.length > 0 && (
                <div className="refinement-cards-list">
                    {visibleSuggestions.map((item, index) => {
                        const isApplied = appliedIds.has(item.id);
                        return (
                            <div 
                                key={item.id || index} 
                                className={`refinement-card ${isApplied ? 'is-applied' : ''}`}
                            >
                                <div className="refinement-card-top">
                                    <div className="card-badge-row">
                                        <span className="fix-number">Option {item.id || index + 1}</span>
                                        <span className={`impact-badge ${getImpactClass(item.impact)}`}>
                                            {item.impact || 'Medium'} Narrative Impact
                                        </span>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="item-dismiss-btn"
                                        onClick={() => handleDismissItem(item.id)}
                                        title="Dismiss this suggestion"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <h5 className="refinement-card-title">{item.title}</h5>

                                <p className="refinement-card-description">
                                    {item.description}
                                </p>

                                {item.canon_rationale && (
                                    <div className="canon-rationale-box">
                                        <span className="rationale-label">🛡️ Canon Alignment:</span>
                                        <p className="rationale-text">{item.canon_rationale}</p>
                                    </div>
                                )}

                                <div className="refinement-card-actions">
                                    <button
                                        type="button"
                                        className={`apply-btn ${isApplied ? 'applied' : ''}`}
                                        onClick={() => handleApply(item)}
                                    >
                                        {isApplied ? '✓ Applied' : 'Apply Suggestion'}
                                    </button>
                                    <button
                                        type="button"
                                        className="dismiss-btn"
                                        onClick={() => handleDismissItem(item.id)}
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RefinementSuggestionCard;
