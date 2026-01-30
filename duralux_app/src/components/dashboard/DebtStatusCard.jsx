'use client'
import React from 'react'

const DebtStatusCard = () => {
    return (
        <div
            className="card"
            style={{
                borderRadius: '24px',
                border: '1px solid var(--ds-border-secondary, #b5b5b5)',
                background: '#343330',
                overflow: 'hidden',
            }}
        >
            <div className="card-body p-4 d-flex flex-column justify-content-between">
                <div>
                    <p
                        className="mb-1"
                        style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#fff',
                            textTransform: 'capitalize',
                        }}
                    >
                        Goal Progress
                    </p>
                    <p
                        className="mb-0"
                        style={{
                            fontSize: '16px',
                            fontWeight: 400,
                            color: '#fff',
                        }}
                    >
                        Annual Giving Goal
                    </p>
                </div>

                <div className="d-flex flex-column gap-3 mt-3">
                    <div
                        className="d-flex align-items-baseline"
                        style={{ paddingRight: '20px' }}
                    >
                        <div
                            style={{
                                height: '19px',
                                width: '62%',
                                borderRadius: '360px',
                                background: '#bbff00',
                                marginRight: '-20px',
                                zIndex: 2,
                                position: 'relative',
                            }}
                        />
                        <div
                            style={{
                                height: '19px',
                                flex: 1,
                                borderRadius: '360px',
                                background: '#d9d9d9',
                                zIndex: 1,
                            }}
                        />
                    </div>

                    <div
                        className="d-flex flex-column align-items-center gap-1"
                        style={{ textAlign: 'center' }}
                    >
                        <span style={{ fontSize: '16px', fontWeight: 500, color: '#fff' }}>
                            $156,000 of $250,000
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: 400, color: '#fff' }}>
                            62% Complete
                        </span>
                    </div>

                    <button
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '360px',
                            background: '#fff',
                            border: 'none',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#343330',
                            cursor: 'pointer',
                        }}
                    >
                        View Details
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DebtStatusCard
