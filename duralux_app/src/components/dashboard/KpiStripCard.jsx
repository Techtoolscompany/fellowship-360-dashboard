'use client'
import React from 'react'
import { FiArrowDownLeft, FiArrowUpRight, FiEye } from 'react-icons/fi'

const KpiStripCard = () => {
    return (
        <div className="col-12">
            <div
                className="d-flex align-items-stretch"
                style={{
                    borderTop: '1px solid var(--ds-border-secondary)',
                    borderBottom: '1px solid var(--ds-border-secondary)',
                }}
            >
                {/* Total Balance Section */}
                <div
                    className="d-flex flex-column gap-2 py-4"
                    style={{ flex: '0 0 auto', paddingRight: '32px' }}
                >
                    <p
                        className="mb-0"
                        style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--ds-text-primary)',
                            lineHeight: 1.5
                        }}
                    >
                        Total Members
                    </p>
                    <div className="d-flex align-items-center gap-2">
                        <span
                            style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'var(--ds-text-primary)',
                                textTransform: 'capitalize',
                                lineHeight: '20px'
                            }}
                        >
                            Active Members
                        </span>
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '360px',
                                background: 'var(--ds-bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FiEye size={20} style={{ color: 'var(--ds-icon-default)' }} />
                        </div>
                    </div>
                </div>

                {/* Vertical Divider */}
                <div
                    style={{
                        width: '1px',
                        background: 'var(--ds-border-secondary)',
                        alignSelf: 'stretch',
                        margin: '0 32px'
                    }}
                />

                {/* Inflows Section */}
                <div
                    className="d-flex flex-column gap-2 py-4"
                    style={{ flex: '0 0 auto', paddingRight: '32px' }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: '#bbff00',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FiArrowDownLeft size={20} color="#343330" />
                        </div>
                        <span
                            style={{
                                fontSize: '16px',
                                fontWeight: 400,
                                color: 'var(--ds-text-secondary)',
                                lineHeight: 1.5
                            }}
                        >
                            New This Month
                        </span>
                    </div>
                    <p
                        className="mb-0"
                        style={{
                            fontSize: '32px',
                            fontWeight: 600,
                            color: 'var(--ds-text-primary)',
                            lineHeight: 1.5
                        }}
                    >
                        + 38
                    </p>
                </div>

                {/* Vertical Divider */}
                <div
                    style={{
                        width: '1px',
                        background: 'var(--ds-border-secondary)',
                        alignSelf: 'stretch',
                        margin: '0 32px'
                    }}
                />

                {/* Outflows Section */}
                <div
                    className="d-flex flex-column gap-2 py-4"
                    style={{ flex: '0 0 auto' }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: '#bbff00',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FiArrowUpRight size={20} color="#343330" />
                        </div>
                        <span
                            style={{
                                fontSize: '16px',
                                fontWeight: 400,
                                color: 'var(--ds-text-secondary)',
                                lineHeight: 1.5
                            }}
                        >
                            Total Count
                        </span>
                    </div>
                    <p
                        className="mb-0"
                        style={{
                            fontSize: '32px',
                            fontWeight: 600,
                            color: 'var(--ds-text-primary)',
                            lineHeight: 1.5
                        }}
                    >
                        1,247
                    </p>
                </div>
            </div>
        </div>
    )
}

export default KpiStripCard
