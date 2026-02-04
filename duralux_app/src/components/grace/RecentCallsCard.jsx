'use client'
import React from 'react'
import { FiMoreVertical, FiPhoneIncoming, FiPhoneOutgoing, FiCheck, FiX, FiVoicemail } from 'react-icons/fi'

const RecentCallsCard = () => {
    const calls = [
        { 
            id: 1, 
            contact: 'Johnson, Sarah', 
            time: '10:32 AM',
            direction: 'outbound',
            outcome: 'connected',
            duration: '4:32',
            intent: 'Follow-up'
        },
        { 
            id: 2, 
            contact: 'Davis, Michael', 
            time: '10:15 AM',
            direction: 'outbound',
            outcome: 'voicemail',
            duration: '1:15',
            intent: 'Welcome'
        },
        { 
            id: 3, 
            contact: 'Chen, David', 
            time: '9:48 AM',
            direction: 'inbound',
            outcome: 'connected',
            duration: '3:22',
            intent: 'Question'
        },
        { 
            id: 4, 
            contact: 'White, Emily', 
            time: '9:30 AM',
            direction: 'outbound',
            outcome: 'no-answer',
            duration: '0:45',
            intent: 'Prayer'
        },
        { 
            id: 5, 
            contact: 'Martinez, Jennifer', 
            time: '9:12 AM',
            direction: 'inbound',
            outcome: 'connected',
            duration: '5:18',
            intent: 'Scheduling'
        },
    ]

    const OutcomeIcon = ({ outcome }) => {
        if (outcome === 'connected') return <FiCheck size={12} color="#16a34a" />
        if (outcome === 'voicemail') return <FiVoicemail size={12} color="#f59e0b" />
        return <FiX size={12} color="#9ca3af" />
    }

    const outcomeColors = {
        connected: { bg: '#dcfce7', text: '#16a34a' },
        voicemail: { bg: '#fef3c7', text: '#d97706' },
        'no-answer': { bg: '#f3f4f6', text: '#6b7280' },
    }

    return (
        <div className="col-xxl-5 col-lg-6">
            <div
                className="card stretch stretch-full"
                style={{ borderRadius: '24px', overflow: 'hidden', height: '100%', minHeight: '333px' }}
            >
                <div className="card-body p-0">
                    <div className="d-flex align-items-center justify-content-between p-4 pb-3">
                        <div>
                            <p className="mb-0" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                                Recent Calls
                            </p>
                            <p className="mb-0" style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                                Today's call activity
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

                    {/* Table Header */}
                    <div
                        className="d-flex align-items-center px-4 py-2"
                        style={{ fontSize: '11px', fontWeight: 500, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                    >
                        <span style={{ flex: 2 }}>Contact</span>
                        <span style={{ flex: 1 }}>Time</span>
                        <span style={{ flex: 1 }}>Intent</span>
                        <span style={{ flex: 1 }}>Duration</span>
                        <span style={{ flex: 1, textAlign: 'right' }}>Outcome</span>
                    </div>

                    {/* Table Body */}
                    <div className="d-flex flex-column px-4 pb-4">
                        {calls.map((call) => (
                            <div
                                key={call.id}
                                className="d-flex align-items-center py-3"
                                style={{ borderBottom: '1px solid var(--ds-border-secondary)' }}
                            >
                                <div style={{ flex: 2 }} className="d-flex align-items-center gap-2">
                                    {call.direction === 'outbound' ? (
                                        <FiPhoneOutgoing size={14} color="#bbff00" />
                                    ) : (
                                        <FiPhoneIncoming size={14} color="#818cf8" />
                                    )}
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ds-text-primary)' }}>
                                        {call.contact}
                                    </span>
                                </div>
                                <span style={{ flex: 1, fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                                    {call.time}
                                </span>
                                <span style={{ flex: 1, fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                                    {call.intent}
                                </span>
                                <span style={{ flex: 1, fontSize: '12px', color: 'var(--ds-text-primary)', fontWeight: 500 }}>
                                    {call.duration}
                                </span>
                                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                    <span
                                        className="d-flex align-items-center gap-1"
                                        style={{
                                            fontSize: '11px', fontWeight: 500, padding: '4px 8px',
                                            borderRadius: '360px',
                                            background: outcomeColors[call.outcome].bg,
                                            color: outcomeColors[call.outcome].text,
                                        }}
                                    >
                                        <OutcomeIcon outcome={call.outcome} />
                                        {call.outcome === 'connected' ? 'Connected' : 
                                         call.outcome === 'voicemail' ? 'Voicemail' : 'No Answer'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RecentCallsCard
