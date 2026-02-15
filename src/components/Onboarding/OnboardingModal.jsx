import React, { useState, useEffect } from 'react';
import './OnboardingModal.css';

const OnboardingModal = () => {
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Check if user has already seen the onboarding
        const hasSeenOnboarding = localStorage.getItem('json-trace-onboarding-seen');

        if (!hasSeenOnboarding) {
            // Delay slightly for smooth entrance after app load
            const timer = setTimeout(() => {
                setShowModal(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        // Save to localStorage so it doesn't show again
        localStorage.setItem('json-trace-onboarding-seen', 'true');
        setShowModal(false);
    };

    if (!showModal) return null;

    return (
        <div className="onboarding-overlay" onClick={handleClose}>
            <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
                {/* Decorative background elements */}
                <div className="modal-glow-orb orb-1"></div>
                <div className="modal-glow-orb orb-2"></div>

                <div className="modal-content-wrapper">
                    <div className="modal-header">
                        <h1 className="modal-title">Experience <span className="text-gradient">JSON Trace</span></h1>
                        <p className="modal-subtitle">
                            Lift off with the next-generation JSON visualizer.
                        </p>
                    </div>

                    <div className="feature-grid">
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg className="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <h3>Visualize</h3>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg className="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <h3>Search</h3>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg className="feature-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <h3>Export HD</h3>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="start-btn" onClick={handleClose}>
                            Get Started
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
