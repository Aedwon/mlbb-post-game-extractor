import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    title: 'WELCOME',
    body: 'Turn your MLBB post-game screenshots into organized stats. Upload, extract, and export — all in one place.',
    label: 'OVERVIEW'
  },
  {
    title: 'UPLOAD SCREENSHOTS',
    body: 'Take a screenshot of each stats tab (Main, DPS, Team, Overall, Farm) from the same match, then upload them all at once.',
    label: 'BATCH_UPLOAD'
  },
  {
    title: 'POSITION THE ZONES',
    body: 'Drag and resize the blue and red boxes to line up with the stat columns on your screenshot. Use Symmetry Lock to move both sides together.',
    label: 'CONFIGURE_ZONES'
  },
  {
    title: 'EXTRACT & REVIEW',
    body: 'Hit "Initialize Batch OCR" to read the numbers. You\'ll get a chance to check and fix any mistakes before saving. OCR isn\'t perfect — it\'s here to speed up your data entry, not replace it. Always double-check the results before exporting.',
    label: 'EXTRACT_REVIEW'
  },
  {
    title: 'EXPORT YOUR DATA',
    body: 'Your extracted stats appear in a table below. Copy it to your clipboard or download as a CSV file.',
    label: 'EXPORT_DATA'
  }
];

export default function OnboardingModal({ onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fading, setFading] = useState(false);

  const isLastSlide = currentSlide === SLIDES.length - 1;
  const slideData = SLIDES[currentSlide];

  const handleNext = () => {
    if (!isLastSlide) {
      changeSlide(currentSlide + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      changeSlide(currentSlide - 1);
    }
  };

  const changeSlide = (newIndex) => {
    setFading(true);
    setTimeout(() => {
      setCurrentSlide(newIndex);
      setFading(false);
    }, 200); // 200ms crossfade
  };

  return (
    <div className="modal-overlay onboarding-overlay">
      <div className="glass-panel onboarding-modal">
        <header className="onboarding-header">
          <div className="onboarding-title-area">
            <h2 className="text-gold">TUTORIAL_MODE</h2>
          </div>
          {isLastSlide && (
            <button className="btn-icon" onClick={onClose} title="Close Tutorial">
              <X size={20} />
            </button>
          )}
        </header>

        <div className={`onboarding-fade ${fading ? 'fading' : ''}`}>
          <div className="onboarding-visual">
            <span className="onboarding-visual-label">
              // STEP_0{currentSlide + 1} &mdash; {slideData.label}
            </span>
          </div>

          <div className="onboarding-body">
            <h3>{slideData.title}</h3>
            <p className="text-muted">{slideData.body}</p>
          </div>
        </div>

        <div className="onboarding-nav">
          <div className="nav-btn-container">
            {currentSlide > 0 && (
              <button className="btn" onClick={handlePrev}>
                <ChevronLeft size={16} /> PREV
              </button>
            )}
          </div>
          
          <div className="onboarding-step-counter">
            [ 0{currentSlide + 1} / 0{SLIDES.length} ]
          </div>

          <div className="nav-btn-container" style={{ textAlign: 'right' }}>
            <button className={`btn ${isLastSlide ? 'btn-cyan' : ''}`} onClick={handleNext}>
              {isLastSlide ? 'INITIALIZE_SESSION' : 'NEXT'} {isLastSlide ? '' : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
