'use client'
import React from 'react'
import { FiMoreVertical, FiPhone, FiMail, FiMessageSquare, FiCalendar, FiHeart, FiUser } from 'react-icons/fi'

const RecentActivityCard = () => {
    const activities = [
        { 
            id: 1, 
            type: 'call',
            icon: FiPhone,
            iconBg: '#bbff00',
            iconColor: '#343330',
            title: 'Call with Sarah Johnson',
            subtitle: 'Follow-up call - Connected',
            time: '10:32 AM',
            status: 'completed'
        },
        { 
            id: 2, 
            type: 'prayer',
            icon: FiHeart,
            iconBg: '#fef3c7',
            iconColor: '#d97706',
            title: 'Prayer Request Received',
            subtitle: 'Michael Davis - Health concern',
            time: '10:15 AM',
            status: 'new'
        },
        { 
            id: 3, 
            type: 'appointment',
            icon: FiCalendar,
            iconBg: '#e0e7ff',
            iconColor: '#4f46e5',
            title: 'Appointment Scheduled',
            subtitle: 'Emily White - Counseling at 3:00 PM',
            time: '9:48 AM',
            status: 'scheduled'
        },
        { 
            id: 4, 
            type: 'email',
            icon: FiMail,
            iconBg: '#818cf8',
            iconColor: '#fff',
            title: 'Email Sent',
            subtitle: 'Welcome message to Robert Brown',
            time: '9:30 AM',
            status: 'sent'
        },
        { 
            id: 5, 
            type: 'inquiry',
            icon: FiMessageSquare,
            iconBg: '#d1fae5',
            iconColor: '#059669',
            title: 'Inquiry Received',
            subtitle: 'Jennifer Martinez - Volunteer interest',
            time: '9:12 AM',
            status: 'new'
        },
        { 
            id: 6, 
            type: 'visitor',
            icon: FiUser,
            iconBg: '#343330',
            iconColor: '#bbff00',
            title: 'Visitor Added to Pipeline',
            subtitle: 'David Chen - First time visitor',
            time: '8:45 AM',
            status: 'new'
        },
    ]

    const statusColors = {
        completed: { bg: '#dcfce7', text: '#16a34a' },
        new: { bg: '#fef3c7', text: '#d97706' },
        scheduled: { bg: '#e0e7ff', text: '#4f46e5' },
        sent: { bg: '#f3f4f6', text: '#6b7280' },
    }

    return (
        <div className="col-xxl-8 col-lg-12">
            <div
                className="card stretch stretch-full"
                style={{ borderRadius: '24px', overflow: 'hidden' }}
            >
                <div className="card-body p-0">
                    <div className="d-flex align-items-center justify-content-between p-4 pb-3">
                        <div>
                            <p className="mb-0" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                                Recent Activity
                            </p>
                            <p className="mb-0" style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                                All communications and requests
                            </p>
                        </div>
                        <button
                            style={{
                                width: '40px', height: '40px', borderRadius: '360px',
                                background: 'var(--ds-bg-tertiary)', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            }}
                        >
                            <FiMoreVertical size={20} style={{ color: 'var(--ds-icon-default)' }} />
                        </button>
                    </div>

                    <div className="d-flex flex-column px-4 pb-4">
                        {activities.map((activity, index) => (
                            <div
                                key={activity.id}
                                className="d-flex align-items-center gap-3 py-3"
                                style={{ 
                                    borderBottom: index < activities.length - 1 ? '1px solid var(--ds-border-secondary)' : 'none' 
                                }}
                            >
                                <div
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: activity.iconBg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <activity.icon size={18} color={activity.iconColor} />
                                </div>
                                
                                <div className="flex-grow-1">
                                    <p className="mb-0" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ds-text-primary)' }}>
                                        {activity.title}
                                    </p>
                                    <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                                        {activity.subtitle}
                                    </span>
                                </div>
                                
                                <div className="text-end">
                                    <span
                                        style={{
                                            fontSize: '11px', fontWeight: 500, padding: '4px 8px',
                                            borderRadius: '360px',
                                            background: statusColors[activity.status]?.bg || '#f3f4f6',
                                            color: statusColors[activity.status]?.text || '#6b7280',
                                        }}
                                    >
                                        {activity.status}
                                    </span>
                                    <p className="mb-0 mt-1" style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                                        {activity.time}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RecentActivityCard
