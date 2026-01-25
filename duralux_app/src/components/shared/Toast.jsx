'use client'
import React, { createContext, useContext, useState, useCallback } from 'react'
import { FiCheck, FiX, FiAlertCircle, FiInfo } from 'react-icons/fi'

const ToastContext = createContext(null)

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

const toastIcons = {
    success: FiCheck,
    error: FiX,
    warning: FiAlertCircle,
    info: FiInfo,
}

const toastColors = {
    success: { bg: '#10b981', text: '#ffffff' },
    error: { bg: '#ef4444', text: '#ffffff' },
    warning: { bg: '#f59e0b', text: '#ffffff' },
    info: { bg: '#3b82f6', text: '#ffffff' },
}

const Toast = ({ id, message, type = 'info', onClose }) => {
    const Icon = toastIcons[type]
    const colors = toastColors[type]

    return (
        <div
            className="toast-item"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                marginBottom: '10px',
                background: colors.bg,
                color: colors.text,
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                animation: 'toastSlideIn 0.3s ease-out',
                minWidth: '280px',
                maxWidth: '400px',
            }}
        >
            <div
                style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <Icon size={14} />
            </div>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{message}</span>
            <button
                onClick={() => onClose(id)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.text,
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    opacity: 0.7,
                }}
            >
                <FiX size={16} />
            </button>
        </div>
    )
}

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random()
        setToasts((prev) => [...prev, { id, message, type }])

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }

        return id
    }, [])

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    const toast = {
        success: (message, duration) => addToast(message, 'success', duration),
        error: (message, duration) => addToast(message, 'error', duration),
        warning: (message, duration) => addToast(message, 'warning', duration),
        info: (message, duration) => addToast(message, 'info', duration),
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <style jsx global>{`
                @keyframes toastSlideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
            <div
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 9999,
                    pointerEvents: 'none',
                }}
            >
                <div style={{ pointerEvents: 'auto' }}>
                    {toasts.map((t) => (
                        <Toast key={t.id} {...t} onClose={removeToast} />
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    )
}

export default Toast