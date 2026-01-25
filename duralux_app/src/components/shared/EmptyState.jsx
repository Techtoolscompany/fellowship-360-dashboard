'use client'
import React from 'react'
import { FiInbox, FiUsers, FiCalendar, FiDollarSign, FiMail, FiPhone, FiHeart, FiTarget, FiFileText, FiBarChart2 } from 'react-icons/fi'

const illustrations = {
    default: FiInbox,
    contacts: FiUsers,
    calendar: FiCalendar,
    donations: FiDollarSign,
    messages: FiMail,
    calls: FiPhone,
    prayer: FiHeart,
    pipeline: FiTarget,
    documents: FiFileText,
    reports: FiBarChart2,
}

const EmptyState = ({ 
    title = 'No data yet',
    description = 'Start by adding your first item',
    icon = 'default',
    action = null,
    actionLabel = 'Get Started',
    size = 'medium'
}) => {
    const Icon = illustrations[icon] || illustrations.default
    const iconSize = size === 'small' ? 48 : size === 'large' ? 96 : 64
    const titleSize = size === 'small' ? 'fs-14' : size === 'large' ? 'fs-20' : 'fs-16'
    const padding = size === 'small' ? 'py-4' : size === 'large' ? 'py-6' : 'py-5'

    return (
        <div className={`text-center ${padding}`}>
            <div 
                className="mx-auto mb-4 d-flex align-items-center justify-content-center"
                style={{
                    width: iconSize * 1.5,
                    height: iconSize * 1.5,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                    animation: 'float 3s ease-in-out infinite',
                }}
            >
                <Icon size={iconSize} style={{ color: '#4f46e5' }} />
            </div>
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>
            <h5 className={`fw-bold mb-2 ${titleSize}`}>{title}</h5>
            <p className="text-muted mb-4" style={{ maxWidth: '320px', margin: '0 auto' }}>
                {description}
            </p>
            {action && (
                <button className="btn btn-primary" onClick={action}>
                    {actionLabel}
                </button>
            )}
        </div>
    )
}

export const EmptyStateCard = (props) => {
    return (
        <div className="card stretch stretch-full">
            <div className="card-body">
                <EmptyState {...props} />
            </div>
        </div>
    )
}

export default EmptyState