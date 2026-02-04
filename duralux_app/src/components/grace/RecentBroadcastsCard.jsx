'use client'
import React from 'react'
import { FiMoreVertical, FiMail, FiMessageSquare, FiPhone, FiCheckCircle, FiClock } from 'react-icons/fi'

const RecentBroadcastsCard = () => {
    const broadcasts = [
        { 
            id: 1, 
            title: 'Sunday Service Reminder', 
            type: 'sms', 
            sent: 'Feb 4, 9:00 AM', 
            recipients: 312, 
            delivered: 298,
            status: 'completed'
        },
        { 
            id: 2, 
            title: 'Prayer Meeting Invite', 
            type: 'email', 
            sent: 'Feb 3, 2:00 PM', 
            recipients: 156, 
            delivered: 152,
            status: 'completed'
        },
        { 
            id: 3, 
            title: 'Volunteer Call-Out', 
            type: 'call', 
            sent: 'Feb 2, 10:30 AM', 
            recipients: 45, 
            delivered: 38,
            status: 'completed'
        },
        { 
            id: 4, 
            title: 'Youth Event Announcement', 
            type: 'sms', 
            sent: 'Scheduled: Feb 5', 
            recipients: 89, 
            delivered: null,
            status: 'scheduled'
        },
    ]

    const TypeIcon = ({ type }) => {
        const icons = {
            sms: FiMessageSquare,
            email: FiMail,
            call: FiPhone,
        }
        const Icon = icons[type] || FiMessageSquare
        return <Icon size={14} />
    }

    return (
        <div className="col-xxl-4 col-lg-6">
            <div
                className="card stretch stretch-full"
                style={{ borderRadius: '24px', overflow: 'hidden', height: '334px' }}
            >
                <div className="card-body p-0">
                    <div className="d-flex align-items-center justify-content-between p-4 pb-3">
                        <div>
                            <p className="mb-0" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                                Recent Broadcasts
                            </p>
                            <p className="mb-0" style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                                Mass communications sent
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

                    <div className="d-flex flex-column gap-3 px-4 pb-4">
                        {broadcasts.map((broadcast) => (
                            <div
                                key={broadcast.id}
                                className="d-flex align-items-center justify-content-between p-3"
                                style={{
                                    background: 'var(--ds-bg-secondary)',
                                    borderRadius: '12px',
                                }}
                            >
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '8px',
                                            background: broadcast.type === 'sms' ? '#bbff00' : 
                                                       broadcast.type === 'email' ? '#818cf8' : '#22c55e',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: broadcast.type === 'sms' ? '#343330' : '#fff',
                                        }}
                                    >
                                        <TypeIcon type={broadcast.type} />
                                    </div>
                                    <div>
                                        <p className="mb-0" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ds-text-primary)' }}>
                                            {broadcast.title}
                                        </p>
                                        <span style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                                            {broadcast.sent}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-end">
                                    {broadcast.status === 'completed' ? (
                                        <>
                                            <div className="d-flex align-items-center gap-1" style={{ color: '#16a34a', fontSize: '12px' }}>
                                                <FiCheckCircle size={12} />
                                                <span>{broadcast.delivered}/{broadcast.recipients}</span>
                                            </div>
                                            <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)' }}>delivered</span>
                                        </>
                                    ) : (
                                        <div className="d-flex align-items-center gap-1" style={{ color: '#f59e0b', fontSize: '12px' }}>
                                            <FiClock size={12} />
                                            <span>Scheduled</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RecentBroadcastsCard
