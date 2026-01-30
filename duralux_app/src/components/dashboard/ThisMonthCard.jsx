'use client'
import React from 'react'

const ThisMonthCard = () => {
    return (
        <div
            className="card"
            style={{
                borderRadius: '24px',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <div className="card-body p-4">
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
                    This Week
                </p>

                <div
                    className="d-flex justify-content-between align-items-end"
                    style={{ marginTop: '24px' }}
                >
                    <div className="d-flex flex-column align-items-center gap-1">
                        <div
                            style={{
                                width: '59px',
                                height: '80px',
                                background: '#d6ff65',
                                borderRadius: '8px',
                            }}
                        />
                        <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)' }}>
                            attendance
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                            1,247
                        </span>
                    </div>

                    <div className="d-flex flex-column align-items-center gap-1">
                        <div
                            style={{
                                width: '59px',
                                height: '60px',
                                background: 'var(--ds-text-muted)',
                                borderRadius: '8px',
                            }}
                        />
                        <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)' }}>
                            online
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                            856
                        </span>
                    </div>
                </div>

                {/* Mini sparkline */}
                <div
                    style={{
                        position: 'absolute',
                        right: '-1px',
                        bottom: '-1px',
                        width: '81px',
                        height: '44px',
                        background: 'var(--ds-text-muted)',
                        borderRadius: '4px 0 0 0',
                        padding: '4px',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        className="d-flex align-items-end gap-1"
                        style={{ height: '100%', padding: '2px' }}
                    >
                        {[19, 16, 21, 18, 19].map((h, i) => (
                            <div key={i} className="d-flex gap-1">
                                <div
                                    style={{
                                        width: '6px',
                                        height: `${h}px`,
                                        background: '#d6ff65',
                                        borderRadius: '1px',
                                    }}
                                />
                                <div
                                    style={{
                                        width: '6px',
                                        height: `${h - 5}px`,
                                        background: 'var(--ds-bg-secondary)',
                                        borderRadius: '1px',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ThisMonthCard
