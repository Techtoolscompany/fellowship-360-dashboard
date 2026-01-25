'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiUser, FiUserPlus, FiPhone, FiCalendar, FiDollarSign, FiHeart, FiMail } from 'react-icons/fi'
import { useToast } from './Toast'

const quickActions = [
    { id: 'contact', label: 'New Contact', icon: FiUserPlus, description: 'Add a person to your database', color: 'primary' },
    { id: 'visitor', label: 'Log Visitor', icon: FiUser, description: 'Record a new visitor', color: 'success' },
    { id: 'call', label: 'Log Call', icon: FiPhone, description: 'Record a phone call', color: 'info' },
    { id: 'appointment', label: 'Schedule Meeting', icon: FiCalendar, description: 'Book an appointment', color: 'warning' },
    { id: 'donation', label: 'Record Donation', icon: FiDollarSign, description: 'Log a contribution', color: 'success' },
    { id: 'prayer', label: 'Prayer Request', icon: FiHeart, description: 'Add a prayer need', color: 'danger' },
    { id: 'message', label: 'Send Message', icon: FiMail, description: 'Start a conversation', color: 'secondary' },
]

const QuickAddModal = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const modalRef = useRef(null)
    const closeButtonRef = useRef(null)
    const toast = useToast()

    useEffect(() => {
        setMounted(true)
        
        const handleOpen = () => setIsOpen(true)
        window.addEventListener('openQuickAdd', handleOpen)
        
        return () => {
            window.removeEventListener('openQuickAdd', handleOpen)
        }
    }, [])

    useEffect(() => {
        if (isOpen && closeButtonRef.current) {
            closeButtonRef.current.focus()
        }
    }, [isOpen])

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            setIsOpen(false)
            return
        }
        
        if (e.key === 'Tab' && modalRef.current) {
            const focusableElements = modalRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault()
                lastElement.focus()
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault()
                firstElement.focus()
            }
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'
        }
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [isOpen, handleKeyDown])

    const handleAction = (action) => {
        setIsOpen(false)
        toast.info(`${action.label} - Coming soon!`)
    }

    if (!mounted || !isOpen) return null

    return createPortal(
        <>
            <div 
                className="quick-add-overlay"
                onClick={() => setIsOpen(false)}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2000,
                    animation: 'fadeIn 0.2s ease',
                }}
            />
            <div
                ref={modalRef}
                className="quick-add-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="quick-add-title"
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.2)',
                    zIndex: 2001,
                    width: '90%',
                    maxWidth: '480px',
                    animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                <div style={{ 
                    padding: '20px 24px', 
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h4 id="quick-add-title" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Quick Add</h4>
                    <button 
                        ref={closeButtonRef}
                        onClick={() => setIsOpen(false)}
                        aria-label="Close"
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <FiX size={20} />
                    </button>
                </div>
                <div style={{ padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {quickActions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => handleAction(action)}
                                className="quick-add-action"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: '16px',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f3f4f6';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div 
                                    className={`bg-soft-${action.color}`}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '10px',
                                    }}
                                >
                                    <action.icon size={18} className={`text-${action.color}`} />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937', marginBottom: '2px' }}>
                                    {action.label}
                                </span>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {action.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ 
                    padding: '12px 16px', 
                    borderTop: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    borderRadius: '0 0 16px 16px',
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        Press <kbd style={{ 
                            background: '#e5e7eb', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                        }}>ESC</kbd> to close
                    </span>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { 
                        opacity: 0; 
                        transform: translate(-50%, -50%) scale(0.9); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translate(-50%, -50%) scale(1); 
                    }
                }
            `}</style>
        </>,
        document.body
    )
}

export default QuickAddModal