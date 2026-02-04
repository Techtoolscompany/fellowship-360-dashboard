'use client'
import React from 'react'
import { FiMoreVertical, FiCheck, FiClock } from 'react-icons/fi'

const TransactionHistoryCard = () => {
    const transactions = [
        { date: '02/04/2025', type: 'Tithe', donor: 'Johnson Family', amount: '$850', status: 'done' },
        { date: '02/04/2025', type: 'Offering', donor: 'Williams, M.', amount: '$125', status: 'done' },
        { date: '02/03/2025', type: 'Building Fund', donor: 'Anonymous', amount: '$2,500', status: 'pending' },
        { date: '02/02/2025', type: 'Missions', donor: 'Chen, D.', amount: '$200', status: 'done' },
        { date: '02/01/2025', type: 'Tithe', donor: 'Garcia Family', amount: '$1,100', status: 'done' },
    ]

    const StatusBadge = ({ status }) => {
        if (status === 'done') {
            return (
                <div
                    className="d-flex align-items-center gap-2"
                    style={{
                        padding: '4px 8px',
                        background: '#c5f4d4',
                        borderRadius: '360px',
                    }}
                >
                    <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiCheck size={16} color="#19cf56" />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#19cf56', textTransform: 'capitalize' }}>
                        Done
                    </span>
                </div>
            )
        }
        return (
            <div
                className="d-flex align-items-center gap-2"
                style={{
                    padding: '4px 8px',
                    background: '#ffdbdb',
                    borderRadius: '360px',
                }}
            >
                <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiClock size={16} color="#fd4a4a" />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#fd4a4a', textTransform: 'capitalize' }}>
                    Pending
                </span>
            </div>
        )
    }

    return (
        <div className="col-xxl-4 col-lg-6">
            <div
                className="card stretch stretch-full"
                style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    height: '100%',
                    minHeight: '333px',
                }}
            >
                <div className="card-body p-0">
                    {/* Header */}
                    <div className="d-flex align-items-center justify-content-between p-4 pb-3">
                        <p
                            className="mb-0"
                            style={{
                                fontSize: '20px',
                                fontWeight: 600,
                                color: 'var(--ds-text-primary)',
                                lineHeight: '28px',
                                textTransform: 'capitalize',
                            }}
                        >
                            Recent Activity
                        </p>
                        <button
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '360px',
                                background: 'var(--ds-bg-tertiary)',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <FiMoreVertical size={20} style={{ color: 'var(--ds-icon-default)' }} />
                        </button>
                    </div>

                    {/* Table Header */}
                    <div
                        className="d-flex align-items-center justify-content-between px-4 py-2"
                        style={{
                            fontSize: '12px',
                            fontWeight: 400,
                            color: 'var(--ds-text-secondary)',
                            textTransform: 'uppercase',
                        }}
                    >
                        <span style={{ width: '70px' }}>Date & Time</span>
                        <span style={{ width: '70px' }}>Amount</span>
                        <span style={{ width: '86px', textAlign: 'center' }}>Status</span>
                    </div>

                    {/* Table Body */}
                    <div className="d-flex flex-column gap-3 px-4 mt-2">
                        {transactions.map((tx, index) => (
                            <div
                                key={index}
                                className="d-flex align-items-center justify-content-between"
                            >
                                <span
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 400,
                                        color: 'var(--ds-text-secondary)',
                                        width: '70px',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {tx.date}
                                </span>
                                <span
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        color: 'var(--ds-text-primary)',
                                        width: '70px',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {tx.amount}
                                </span>
                                <div style={{ width: '86px', display: 'flex', justifyContent: 'flex-end' }}>
                                    <StatusBadge status={tx.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TransactionHistoryCard
