import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
    const navigate = useNavigate();

    const features = [
        {
            icon: '🎯',
            title: 'Visual Clarity',
            description: 'Transform complex JSON into beautiful, interactive graphs'
        },
        {
            icon: '🔍',
            title: 'Smart Search',
            description: 'Find any key or value instantly with intelligent highlighting'
        },
        {
            icon: '⚡',
            title: 'Lightning Fast',
            description: 'Handle massive JSON files with optimized performance'
        },
        {
            icon: '🎨',
            title: 'Collapse & Expand',
            description: 'Navigate hierarchies with Google Mind Map-style controls'
        }
    ];

    return (
        <div className="landing-container">
            {/* Animated background */}
            <div className="landing-bg">
                <div className="bg-gradient"></div>
                <div className="bg-dots"></div>
            </div>

            {/* Main content */}
            <div className="landing-content">
                {/* Logo and branding */}
                <div className="brand-section">
                    <div className="logo-container">
                        <div className="logo-icon">
                            <span className="bracket">{'{'}</span>
                            <span className="flow-symbol">~</span>
                            <span className="bracket">{'}'}</span>
                        </div>
                    </div>
                    <h1 className="product-name">
                        <span className="name-json">Json</span>
                        <span className="name-flow">Flow</span>
                    </h1>
                    <p className="tagline">Visualize JSON like never before</p>
                </div>

                {/* Features grid */}
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="feature-card"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-description">{feature.description}</p>
                        </div>
                    ))}
                </div>

                {/* CTA Button */}
                <button
                    className="cta-button"
                    onClick={() => navigate('/app')}
                >
                    <span className="cta-text">Get Started</span>
                    <span className="cta-arrow">→</span>
                </button>

                {/* Author attribution */}
                <div className="landing-footer">
                    <span className="footer-text">Created by</span>
                    <a
                        href="https://www.linkedin.com/in/joel-eapen/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-link"
                    >
                        Joel Varghese
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Landing;
