import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ReportModal } from '../components/ReportModal';
import { RefinementSuggestionCard } from '../components/RefinementSuggestionCard';
import './StoryDetail.css';
import '../styles/shared.css';

const KNOWN_CHARS = [
    "Tony Stark", "Iron Man", "Steve Rogers", "Captain America", "Thor", "Bruce Banner",
    "Hulk", "Natasha Romanoff", "Black Widow", "Clint Barton", "Hawkeye", "Loki",
    "Thanos", "Peter Parker", "Spider-Man", "Wanda Maximoff", "Scarlet Witch", "Vision",
    "Stephen Strange", "Doctor Strange", "T'Challa", "Black Panther", "Nick Fury", "Carol Danvers"
];

// Helper to extract timeline items and match contradiction issues from script report
const extractTimelineFromReport = (reportDoc) => {
    if (!reportDoc) return [];

    const scriptText = reportDoc.script || '';
    const reportData = reportDoc.report || {};
    const justifications = Array.isArray(reportData.justification) ? reportData.justification : [];
    
    // Split into sentences
    const rawSents = scriptText
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 5);

    let currentYear = '2026';
    const items = [];

    rawSents.forEach((sent, idx) => {
        const yearMatch = sent.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
            currentYear = yearMatch[0];
        }

        // Detect mentioned characters
        const matchedChars = KNOWN_CHARS.filter(c => sent.toLowerCase().includes(c.toLowerCase()));

        // Check if any contradiction justification relates to this sentence or characters
        const relatedErrors = justifications.filter(j => {
            const jLower = j.toLowerCase();
            const hasCommonChar = matchedChars.some(c => jLower.includes(c.toLowerCase()));
            const mentionsWords = sent.split(' ').some(w => w.length > 4 && jLower.includes(w.toLowerCase()));
            return hasCommonChar || mentionsWords;
        });

        items.push({
            id: idx,
            year: currentYear,
            text: sent,
            characters: matchedChars,
            hasError: relatedErrors.length > 0,
            errorDetails: relatedErrors.length > 0 ? relatedErrors[0] : null
        });
    });

    // If script had no sentence matches but has justifications, append general contradiction milestones
    if (items.length === 0 && justifications.length > 0) {
        justifications.forEach((j, idx) => {
            items.push({
                id: idx,
                year: '2026',
                text: `Narrative Milestone #${idx + 1}`,
                characters: [],
                hasError: true,
                errorDetails: j
            });
        });
    }

    // Ensure all unmapped justifications still appear on the timeline as flagged events
    justifications.forEach((j, jIdx) => {
        const alreadyMapped = items.some(it => it.errorDetails === j);
        if (!alreadyMapped) {
            items.push({
                id: `unmapped-${jIdx}`,
                year: currentYear,
                text: `Canon Consistency Alert: Narrative issue detected in script submission.`,
                characters: [],
                hasError: true,
                errorDetails: j
            });
        }
    });

    return items;
};

export const StoryDetail = ({ stories }) => {
    const { storyName } = useParams();
    const decodedName = decodeURIComponent(storyName);

    const [activeStory, setActiveStory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [fetchingReportId, setFetchingReportId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Tab state: 'files' | 'timeline'
    const [activeTab, setActiveTab] = useState('files');
    const [selectedTimelineFile, setSelectedTimelineFile] = useState(null);
    const [timelineItems, setTimelineItems] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);

    useEffect(() => {
        if (stories && stories.length > 0) {
            const found = stories.find(s => s.name === decodedName);
            if (found) {
                setActiveStory(found);
                if (found.files && found.files.length > 0 && !selectedTimelineFile) {
                    setSelectedTimelineFile(found.files[0]);
                }
                setLoading(false);
            } else {
                setLoading(false);
            }
        } else {
            const timer = setTimeout(() => {
                setLoading(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [stories, decodedName, selectedTimelineFile]);

    // Fetch report by file metadata
    const fetchReportData = async (file) => {
        if (!file.title) {
            throw new Error('Invalid file metadata: missing script title');
        }
        const num = parseInt(file.title.replace('Script_', ''), 10);
        if (isNaN(num)) {
            throw new Error(`Could not parse script number from title: ${file.title}`);
        }
        const response = await axios.post('http://localhost:5000/get-report', { num });
        return response.data;
    };

    const viewReport = async (file) => {
        setFetchingReportId(file.title);
        setErrorMsg('');

        try {
            const data = await fetchReportData(file);
            setSelectedReport(data);
            setShowModal(true);
        } catch (err) {
            console.error("Failed to fetch report:", err);
            setErrorMsg(`Failed to load report: ${err.response?.data?.error || err.message}`);
        } finally {
            setFetchingReportId(null);
        }
    };

    // Load timeline view for selected script file
    const loadTimelineForFile = async (file) => {
        setSelectedTimelineFile(file);
        setActiveTab('timeline');
        setTimelineLoading(true);
        setErrorMsg('');

        try {
            const reportData = await fetchReportData(file);
            const timeline = extractTimelineFromReport(reportData);
            setTimelineItems(timeline);
        } catch (err) {
            console.error("Failed to load timeline for file:", err);
            setErrorMsg(`Timeline load error: ${err.message}`);
            setTimelineItems([]);
        } finally {
            setTimelineLoading(false);
        }
    };

    // Automatically load timeline when switching to timeline tab
    useEffect(() => {
        if (activeTab === 'timeline' && selectedTimelineFile && timelineItems.length === 0 && !timelineLoading) {
            loadTimelineForFile(selectedTimelineFile);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedTimelineFile]);

    if (loading) {
        return (
            <div className="page-container">
                <div className="page-content">
                    <div className="story-detail-loading">
                        <div className="loader-spinner"></div>
                        <p>Loading story details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!activeStory) {
        return (
            <div className="page-container">
                <div className="page-content">
                    <div className="story-detail-notfound">
                        <h2>Story Not Found</h2>
                        <p>We couldn't find a story named "{decodedName}".</p>
                        <Link to="/mystories" className="back-link">← Back to My Stories</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-content">
                <div className="story-detail-container">
                    <div className="story-detail-header">
                        <Link to="/mystories" className="back-link">← Back to My Stories</Link>
                        <h1>{activeStory.name}</h1>
                        <p className="story-desc">{activeStory.description || "No description provided."}</p>
                        <div className="story-meta-info">
                            <span>Total Files: {activeStory.files?.length || 0}</span>
                            {activeStory.lastModified && <span>Last Modified: {activeStory.lastModified}</span>}
                        </div>
                    </div>

                    {errorMsg && <div className="error-message-banner">{errorMsg}</div>}

                    {/* View Switcher Tabs */}
                    <div className="story-view-tabs">
                        <button 
                            type="button"
                            className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
                            onClick={() => setActiveTab('files')}
                        >
                            <span>📁</span> Story Files
                        </button>
                        <button 
                            type="button"
                            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                            onClick={() => setActiveTab('timeline')}
                            disabled={!activeStory.files || activeStory.files.length === 0}
                        >
                            <span>⏱</span> Timeline & AI Consistency Inspector
                        </button>
                    </div>

                    {/* Tab 1: Story Files Grid */}
                    {activeTab === 'files' && (
                        <>
                            <h2 className="section-title">Committed Scripts</h2>
                            {!activeStory.files || activeStory.files.length === 0 ? (
                                <div className="empty-files-state">
                                    <div className="empty-files-icon">📁</div>
                                    <p>No scripts have been committed to this story yet.</p>
                                    <p className="sub-text">Go back to the upload panel in My Stories to add scripts.</p>
                                </div>
                            ) : (
                                <div className="files-list-grid">
                                    {activeStory.files.map((file, i) => (
                                        <div key={i} className="file-detail-card">
                                            <div className="file-card-main">
                                                <div className="file-icon">📄</div>
                                                <div className="file-meta">
                                                    <div className="file-title-name" title={file.name}>
                                                        {file.name}
                                                    </div>
                                                    <div className="file-sub-info">
                                                        <span className="file-id">{file.title || `Script_${i + 1}`}</span>
                                                        {file.date && <span className="file-date">Committed: {file.date}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="inspect-timeline-btn"
                                                    onClick={() => loadTimelineForFile(file)}
                                                >
                                                    Inspect Timeline
                                                </button>
                                                <button 
                                                    className="view-report-btn" 
                                                    onClick={() => viewReport(file)}
                                                    disabled={fetchingReportId === file.title}
                                                >
                                                    {fetchingReportId === file.title ? "Loading..." : "View AI Report"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Tab 2: Interactive Timeline View with Contradiction Suggestions */}
                    {activeTab === 'timeline' && (
                        <div className="timeline-view-wrapper">
                            <div className="timeline-inspector-header">
                                <div className="timeline-inspector-title">
                                    <h3>Narrative Timeline & Canon Contradiction Inspector</h3>
                                    <p>Chronological sequence with automated knowledge graph contradiction detection</p>
                                </div>
                                {activeStory.files && activeStory.files.length > 1 && (
                                    <select
                                        className="timeline-script-select"
                                        value={selectedTimelineFile?.title || ''}
                                        onChange={(e) => {
                                            const f = activeStory.files.find(item => item.title === e.target.value);
                                            if (f) loadTimelineForFile(f);
                                        }}
                                    >
                                        {activeStory.files.map((f, idx) => (
                                            <option key={idx} value={f.title}>
                                                {f.name} ({f.title})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {timelineLoading && (
                                <div className="story-detail-loading" style={{ padding: '3rem 1rem' }}>
                                    <div className="loader-spinner"></div>
                                    <p>Parsing narrative events and verifying canon consistency...</p>
                                </div>
                            )}

                            {!timelineLoading && timelineItems.length === 0 && (
                                <div className="empty-files-state">
                                    <p>No timeline events found for this script.</p>
                                </div>
                            )}

                            {!timelineLoading && timelineItems.length > 0 && (
                                <div className="timeline-tree">
                                    {timelineItems.map((item, idx) => (
                                        <div key={item.id || idx} className="timeline-node-item">
                                            <div className={`timeline-node-marker ${item.hasError ? 'has-error' : ''}`} />
                                            <div className="timeline-node-card">
                                                <div className="timeline-node-header">
                                                    <span className="timeline-year-tag">{item.year}</span>
                                                    {item.characters && item.characters.length > 0 && (
                                                        <div className="timeline-char-tags">
                                                            {item.characters.map((c, ci) => (
                                                                <span key={ci} className="timeline-char-tag">👤 {c}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="timeline-event-text">{item.text}</p>

                                                {/* Contradiction alert with RefinementSuggestionCard trigger */}
                                                {item.hasError && (
                                                    <div className="timeline-contradiction-error">
                                                        <div className="timeline-error-header">
                                                            <span className="error-badge-icon">⚠️</span>
                                                            <span className="error-title">Canon Contradiction Detected</span>
                                                        </div>
                                                        <p className="timeline-error-text">
                                                            {item.errorDetails}
                                                        </p>
                                                        <div className="timeline-error-actions">
                                                            <RefinementSuggestionCard
                                                                scriptId={selectedTimelineFile?.title}
                                                                contradictionId={`timeline-${idx}`}
                                                                contradictionText={item.errorDetails}
                                                                characterName={item.characters?.[0]}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedReport && (
                        <ReportModal 
                            open={showModal} 
                            onClose={() => {
                                setShowModal(false);
                                setSelectedReport(null);
                            }} 
                            apiResp={selectedReport} 
                            hideCommit={true}
                            fileName={selectedReport.fileName || "Committed Script"}
                            storyName={activeStory.name}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
