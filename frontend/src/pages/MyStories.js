import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ReportModal } from '../components/ReportModal';
import './myStories.css';
import '../styles/shared.css';

/* parse llm_response string safely */
const parseLLM = (payload) => {
    try {
        const raw = payload.llm_response?.replace(/```json|```/g, '') || '{}';
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

/* ───────── Upload panel ───────── */
const UploadBox = ({ stories }) => {
    const [count, setCount] = useState(1);
    const fileRef = useRef(null);
    const [story, setStory] = useState('');
    const [fileName, setFileName] = useState('');
    const [status, setStatus] = useState('idle');   // idle | uploading | success | error
    const [apiResp, setApiResp] = useState(null);
    const [errMsg, setErrMsg] = useState('');
    const [showModal, setShowModal] = useState(false);

    const API_ENDPOINT = 'http://localhost:5000/parse';

    const chooseFile = () => fileRef.current?.click();

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setErrMsg('Please choose a PDF'); setStatus('error'); return;
        }
        if (!story) {
            setErrMsg('Select a story first'); setStatus('error'); return;
        }

        setFileName(file.name);
        setStatus('uploading');
        setErrMsg('');

        const fd = new FormData();
        fd.append('pdf', file);       // backend expects key = 'pdf'
        fd.append('storyName', story);

        try {
            const resp = await fetch(API_ENDPOINT, { method: 'POST', body: fd });
            if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
            const json = await resp.json();

            setApiResp(json);   // pass to modal
            setStatus('success');
            setShowModal(true); // open popup
        } catch (er) {
            setErrMsg(`Upload failed: ${er.message}`);
            setStatus('error');
        }
    };

    return (
        <div className="upload-box">
            <h3>Upload PDF to a Story</h3>

            <select className="story-dropdown" value={story}
                onChange={e => { setStory(e.target.value); setStatus('idle'); }}>
                <option value="">Select Story</option>
                {stories.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
            </select>

            <button className="custom-upload-button" onClick={chooseFile}>Choose PDF File</button>
            <input type="file" accept="application/pdf" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />

            {fileName && <div className="selected-file">Selected: {fileName}</div>}
            {status === 'uploading' && <div className="uploading-msg">Uploading…</div>}
            {status === 'success' && <div className="upload-success">Uploaded!</div>}
            {status === 'error' && <div className="upload-error">{errMsg}</div>}

            <ReportModal open={showModal} onClose={() => setShowModal(false)} apiResp={apiResp} count={count} setCount={setCount} />
        </div>
    );
};

/* ───────── MyStories page ───────── */
export const MyStories = ({ stories }) => {
    const [hover, setHover] = useState(null);

    return (
        <div className="page-container">
            <div className="page-content">
                <div className="my-stories-container">
                    <div className="my-stories-header">
                        <h1>My Stories</h1>
                        <div className="header-subtitle">
                            Your personal collection of epic tales and adventures
                        </div>
                    </div>

                    {/* Upload Box always shows at the top */}
                    <UploadBox stories={stories} />

                    {stories.length === 0 ? (
                        <div className="empty-stories">
                            <div className="empty-icon">📚</div>
                            <p>No stories yet. Create one!</p>
                        </div>
                    ) : (
                        <div className="stories-grid">
                            {stories.map((s, i) => (
                                <Link key={i}
                                    to={`/mystories/${encodeURIComponent(s.name)}`}
                                    className={`story-folder ${hover === i ? 'hovered' : ''}`}
                                    onMouseEnter={() => setHover(i)}
                                    onMouseLeave={() => setHover(null)}>
                                    <div className="story-icon">📖</div>
                                    <div className="story-name">{s.name}</div>

                                    {/* Display additional story info */}
                                    <div className="story-info">
                                        <p className="story-description">{s.description}</p>
                                        <span className="story-files">{s.files?.length || 0} files</span>
                                        <span className="story-date">Last modified: {s.lastModified}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
