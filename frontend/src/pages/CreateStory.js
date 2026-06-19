import React, { useState } from 'react';
import '../styles/shared.css';
import './CreateStory.css';

export const CreateStory = ({ setStories }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Handle creating a new story
    const handleCreateStory = () => {
        setIsSubmitting(true);

        // Simulate a brief loading state for better UX
        setTimeout(() => {
            // Get the current number of stories to determine the next story number
            setStories((prevStories) => {
                const nextStoryNumber = prevStories.length + 1;
                const newStoryName = `Story${nextStoryNumber}`;

                // Create new story and add to the list of stories
                const updatedStories = [
                    ...prevStories,
                    { 
                        name: newStoryName, 
                        files: [],
                        description: 'A new Marvel Universe story',
                        lastModified: new Date().toLocaleDateString()
                    }
                ];

                setSuccessMessage(`Story "${newStoryName}" created successfully!`);

                // Clear success message after 3 seconds
                setTimeout(() => {
                    setSuccessMessage('');
                }, 3000);

                return updatedStories;
            });

            setIsSubmitting(false);
        }, 800);
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
