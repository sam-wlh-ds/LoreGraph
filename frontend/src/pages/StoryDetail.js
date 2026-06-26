import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ReportModal } from '../components/ReportModal';
import './StoryDetail.css';
import '../styles/shared.css';

export const StoryDetail = ({ stories }) => {
    const { storyName } = useParams();
    const decodedName = decodeURIComponent(storyName);

    const [activeStory, setActiveStory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [fetchingReportId, setFetchingReportId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (stories && stories.length > 0) {
            const found = stories.find(s => s.name === decodedName);
            if (found) {
                setActiveStory(found);
                setLoading(false);
            } else {
                setLoading(false);
            }
        } else {
            // Handle case where stories fetch is still in progress
            const timer = setTimeout(() => {
                setLoading(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [stories, decodedName]);

    const viewReport = async (file) => {
        if (!file.title) {
            setErrorMsg('Invalid file metadata: missing script title');
            return;
        }

        // Extract script number from title (e.g. "Script_1" -> 1)
        const num = parseInt(file.title.replace('Script_', ''), 10);
        if (isNaN(num)) {
            setErrorMsg(`Could not parse script number from title: ${file.title}`);
            return;
        }

        setFetchingReportId(file.title);
        setErrorMsg('');

        try {
            const response = await axios.post('http://localhost:5000/get-report', { num });
            setSelectedReport(response.data);
            setShowModal(true);
        } catch (err) {
            console.error("Failed to fetch report:", err);
            setErrorMsg(`Failed to load report: ${err.response?.data?.error || err.message}`);
        } finally {
            setFetchingReportId(null);
        }
    };

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

                    <h2 className="section-title">Story Files</h2>
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
                                    <button 
                                        className="view-report-btn" 
                                        onClick={() => viewReport(file)}
                                        disabled={fetchingReportId === file.title}
                                    >
                                        {fetchingReportId === file.title ? "Loading..." : "View AI Report"}
                                    </button>
                                </div>
                            ))}
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
