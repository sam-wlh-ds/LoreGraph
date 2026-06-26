import React, { useState } from 'react';
import '../styles/shared.css';
import './CreateStory.css';

export const CreateStory = ({ stories, setStories }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Handle creating a new story
    const handleCreateStory = async () => {
        setIsSubmitting(true);
        setSuccessMessage('');

        // Determine the next story number based on current stories count
        const nextStoryNumber = (stories?.length || 0) + 1;
        const newStoryName = `Story${nextStoryNumber}`;

        const newStory = { 
            name: newStoryName, 
            files: [],
            description: 'A new Marvel Universe story',
            lastModified: new Date().toLocaleDateString()
        };

        try {
            // Persist the new story in MongoDB
            const response = await fetch('http://localhost:5000/stories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newStory)
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            // Update local React state
            setStories((prevStories) => [...(prevStories || []), newStory]);
            setSuccessMessage(`Story "${newStoryName}" created and saved to MongoDB!`);

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);

        } catch (err) {
            console.error("Failed to save story to MongoDB:", err);
            setSuccessMessage(`Error: Failed to save story to database (${err.message})`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page-container">
            <div className="create-story-container">
                <div className="create-story-header">
                    <h1>Create a New Story</h1>
                    <p>Begin your journey into the Marvel Universe</p>
                </div>

                <div className="create-story-content">
                    {successMessage && (
                        <div className="success-message">
                            {successMessage}
                        </div>
                    )}

                    <div className="create-story-form">
                        <p>Ready to create your next masterpiece? Click below to start a new story.</p>
                        <button
                             onClick={handleCreateStory}
                             className={`story-button ${isSubmitting ? 'submitting' : ''}`}
                             disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Creating...' : 'Create New Story'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
