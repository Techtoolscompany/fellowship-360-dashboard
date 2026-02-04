'use client'
import React from 'react'
import { FiAlertCircle, FiUser, FiPhone, FiClock } from 'react-icons/fi'

const FollowUpRequestsCard = () => {
    const requests = [
        { 
            id: 1, 
            contact: 'Sarah Johnson', 
            reason: 'Requested prayer',
            priority: 'high',
            dueDate: 'Today',
            source: 'Call'
        },
        { 
            id: 2, 
            contact: 'Michael Davis', 
            reason: 'Left voicemail - needs callback',
            priority: 'medium',
            dueDate: 'Today',
            source: 'Voicemail'
        },
        { 
            id: 3, 
            contact: 'Emily White', 
            reason: 'New visitor - welcome call',
            priority: 'medium',
            dueDate: 'Tomorrow',
            source: 'Check-in'
        },
        { 
            id: 4, 
            contact: 'Robert Brown', 
            reason: 'Missed 3 Sundays',
            priority: 'low',
            dueDate: 'This week',
            source: 'Attendance'
        },
    ]

    const priorityColors = {
        high: { bg: '#fee2e2', text: '#dc2626' },
        medium: { bg: '#fef3c7', text: '#d97706' },
        low: { bg: '#e0f2fe', text: '#0284c7' },
    }

    return (
        <div className="col-xxl-3 col-lg-6">
            <div
                className="card h-100"
                style={{
                    borderRadius: '24px',
                    border: '1px solid var(--ds-border-secondary)',
                    background: '#343330',
                    overflow: 'hidden',
                }}
            >
                <div className="card-body p-4 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                            <p className="mb-1" style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                                Follow-Up Queue
                            </p>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                {requests.length} pending requests
                            </span>
                        </div>
                        <div
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(187, 255, 0, 0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <FiAlertCircle size={20} color="#bbff00" />
                        </div>
                    </div>

                    <div className="d-flex flex-column gap-3 flex-grow-1">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="d-flex align-items-start gap-3 p-3"
                                style={{ background: '#4b4b47', borderRadius: '12px' }}
                            >
                                <div
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: '#5c5c58',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}
                                >
                                    <FiUser size={14} color="#fff" />
                                </div>
                                <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <p className="mb-0" style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>
                                            {request.contact}
                                        </p>
                                        <span
                                            style={{
                                                fontSize: '10px', fontWeight: 500, padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: priorityColors[request.priority].bg,
                                                color: priorityColors[request.priority].text,
                                            }}
                                        >
                                            {request.priority}
                                        </span>
                                    </div>
                                    <p className="mb-1" style={{ fontSize: '11px', color: '#9ca3af' }}>
                                        {request.reason}
                                    </p>
                                    <div className="d-flex align-items-center gap-2">
                                        <FiClock size={10} color="#9ca3af" />
                                        <span style={{ fontSize: '10px', color: '#bbff00' }}>{request.dueDate}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: '360px',
                            background: '#fff', border: 'none',
                            fontSize: '14px', fontWeight: 600, color: '#343330',
                            cursor: 'pointer', marginTop: '16px',
                        }}
                    >
                        View All Requests
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FollowUpRequestsCard
