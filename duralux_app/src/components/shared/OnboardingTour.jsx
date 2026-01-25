'use client'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiChevronRight, FiChevronLeft, FiCheck } from 'react-icons/fi'

const tourSteps = [
    {
        target: '.nxl-navigation',
        title: 'Navigation Menu',
        content: 'Access all Fellowship 360 modules from here. Use the sidebar to navigate between People, Engage, Giving, and more.',
        position: 'right'
    },
    {
        target: '.search-modal-toggle',
        title: 'Quick Search',
        content: 'Press Cmd+K (or Ctrl+K) to open the command palette for quick navigation and search.',
        position: 'bottom'
    },
    {
        target: '.dark-mode-toggle',
        title: 'Dark Mode',
        content: 'Toggle between light and dark themes for comfortable viewing day or night.',
        position: 'bottom'
    },
    {
        target: '.main-content',
        title: 'Dashboard Overview',
        content: 'Your home dashboard shows key metrics, recent activity, and quick actions to help you stay on top of your ministry.',
        position: 'center'
    },
]

const OnboardingTour = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0)
    const [isVisible, setIsVisible] = useState(true)
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    useEffect(() => {
        if (!isVisible || !mounted) return

        const step = tourSteps[currentStep]
        const targetElement = document.querySelector(step.target)

        if (targetElement && step.position !== 'center') {
            const rect = targetElement.getBoundingClientRect()
            let top, left

            switch (step.position) {
                case 'right':
                    top = rect.top + rect.height / 2 - 80
                    left = rect.right + 20
                    break
                case 'bottom':
                    top = rect.bottom + 20
                    left = rect.left + rect.width / 2 - 175
                    break
                case 'left':
                    top = rect.top + rect.height / 2 - 80
                    left = rect.left - 370
                    break
                case 'top':
                    top = rect.top - 180
                    left = rect.left + rect.width / 2 - 175
                    break
                default:
                    top = window.innerHeight / 2 - 100
                    left = window.innerWidth / 2 - 175
            }

            left = Math.max(20, Math.min(left, window.innerWidth - 370))
            top = Math.max(20, Math.min(top, window.innerHeight - 200))

            setTooltipPosition({ top, left })
            
            targetElement.style.position = 'relative'
            targetElement.style.zIndex = '1060'
            targetElement.classList.add('tour-highlight')
        } else {
            setTooltipPosition({
                top: window.innerHeight / 2 - 100,
                left: window.innerWidth / 2 - 175
            })
        }

        return () => {
            const prevTarget = document.querySelector(step.target)
            if (prevTarget) {
                prevTarget.style.zIndex = ''
                prevTarget.classList.remove('tour-highlight')
            }
        }
    }, [currentStep, isVisible, mounted])

    const handleNext = () => {
        if (currentStep < tourSteps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            handleComplete()
        }
    }

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleComplete = () => {
        setIsVisible(false)
        localStorage.setItem('fellowship360_tour_completed', 'true')
        if (onComplete) onComplete()
    }

    const handleSkip = () => {
        setIsVisible(false)
        localStorage.setItem('fellowship360_tour_completed', 'true')
        if (onComplete) onComplete()
    }

    if (!isVisible || !mounted) return null

    const step = tourSteps[currentStep]

    return createPortal(
        <>
            <div 
                className="tour-overlay" 
                onClick={handleSkip}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    zIndex: 1055,
                }}
            />
            <div
                className="tour-tooltip"
                style={{
                    position: 'fixed',
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                    width: '350px',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
                    zIndex: 1070,
                    animation: 'fadeInUp 0.3s ease',
                }}
            >
                <div className="tour-header" style={{ 
                    padding: '1rem 1.25rem', 
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{step.title}</h5>
                    <button 
                        onClick={handleSkip}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer',
                            color: '#666',
                            padding: '4px'
                        }}
                    >
                        <FiX size={18} />
                    </button>
                </div>
                <div className="tour-body" style={{ padding: '1.25rem' }}>
                    <p style={{ margin: 0, color: '#555', lineHeight: 1.6 }}>{step.content}</p>
                </div>
                <div className="tour-footer" style={{ 
                    padding: '1rem 1.25rem', 
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div className="tour-dots" style={{ display: 'flex', gap: '6px' }}>
                        {tourSteps.map((_, index) => (
                            <span
                                key={index}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: index === currentStep ? '#3b82f6' : '#ddd',
                                    transition: 'background 0.2s'
                                }}
                            />
                        ))}
                    </div>
                    <div className="tour-actions" style={{ display: 'flex', gap: '8px' }}>
                        {currentStep > 0 && (
                            <button
                                onClick={handlePrev}
                                className="btn btn-sm btn-outline-secondary"
                            >
                                <FiChevronLeft size={14} /> Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="btn btn-sm btn-primary"
                        >
                            {currentStep === tourSteps.length - 1 ? (
                                <>
                                    <FiCheck size={14} className="me-1" /> Finish
                                </>
                            ) : (
                                <>
                                    Next <FiChevronRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .tour-highlight {
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5) !important;
                    border-radius: 8px;
                }
            `}</style>
        </>,
        document.body
    )
}

export const useOnboardingTour = () => {
    const [showTour, setShowTour] = useState(false)

    useEffect(() => {
        const tourCompleted = localStorage.getItem('fellowship360_tour_completed')
        if (!tourCompleted) {
            const timer = setTimeout(() => setShowTour(true), 1500)
            return () => clearTimeout(timer)
        }
    }, [])

    const startTour = () => setShowTour(true)
    const resetTour = () => {
        localStorage.removeItem('fellowship360_tour_completed')
        setShowTour(true)
    }

    return { showTour, startTour, resetTour, TourComponent: showTour ? OnboardingTour : null }
}

export default OnboardingTour