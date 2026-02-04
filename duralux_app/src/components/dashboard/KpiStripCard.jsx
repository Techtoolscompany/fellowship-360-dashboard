'use client'
import React from 'react'
import { FiUsers, FiUserPlus, FiDollarSign, FiClock, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'

const KpiStripCard = () => {
    // Sample data - will be replaced with real data from database
    const kpis = [
        {
            label: 'Active Members',
            value: '247',
            subtitle: 'Attended in last 30 days',
            icon: FiUsers,
            trend: '+12',
            trendDirection: 'up',
            iconBg: '#bbff00'
        },
        {
            label: 'First-Time Visitors',
            value: '8',
            subtitle: 'This week',
            icon: FiUserPlus,
            trend: '+3',
            trendDirection: 'up',
            iconBg: '#bbff00'
        },
        {
            label: 'Weekly Giving',
            value: '$4,832',
            subtitle: 'This week',
            icon: FiDollarSign,
            trend: '-5%',
            trendDirection: 'down',
            iconBg: '#bbff00'
        },
        {
            label: 'Volunteer Hours',
            value: '156',
            subtitle: 'This month',
            icon: FiClock,
            trend: '+24',
            trendDirection: 'up',
            iconBg: '#bbff00'
        }
    ]

    return (
        <div className="col-12">
            <div
                className="d-flex align-items-stretch flex-wrap"
                style={{
                    borderTop: '1px solid var(--ds-border-secondary)',
                    borderBottom: '1px solid var(--ds-border-secondary)',
                }}
            >
                {kpis.map((kpi, index) => (
                    <React.Fragment key={kpi.label}>
                        <div
                            className="d-flex flex-column gap-2 py-4"
                            style={{ 
                                flex: '1 1 200px', 
                                minWidth: '180px',
                                paddingRight: '24px',
                                paddingLeft: index > 0 ? '24px' : '0'
                            }}
                        >
                            {/* Label and Icon Row */}
                            <div className="d-flex align-items-center gap-2">
                                <div
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '6px',
                                        background: kpi.iconBg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <kpi.icon size={18} color="#343330" />
                                </div>
                                <span
                                    style={{
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'var(--ds-text-secondary)',
                                        lineHeight: 1.5
                                    }}
                                >
                                    {kpi.label}
                                </span>
                            </div>
                            
                            {/* Value and Trend Row */}
                            <div className="d-flex align-items-end gap-2">
                                <p
                                    className="mb-0"
                                    style={{
                                        fontSize: '28px',
                                        fontWeight: 600,
                                        color: 'var(--ds-text-primary)',
                                        lineHeight: 1.2
                                    }}
                                >
                                    {kpi.value}
                                </p>
                                <span
                                    className="d-flex align-items-center gap-1 mb-1"
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        color: kpi.trendDirection === 'up' ? '#16a34a' : '#dc2626',
                                    }}
                                >
                                    {kpi.trendDirection === 'up' ? (
                                        <FiTrendingUp size={12} />
                                    ) : (
                                        <FiTrendingDown size={12} />
                                    )}
                                    {kpi.trend}
                                </span>
                            </div>
                            
                            {/* Subtitle */}
                            <span
                                style={{
                                    fontSize: '12px',
                                    color: 'var(--ds-text-muted)',
                                }}
                            >
                                {kpi.subtitle}
                            </span>
                        </div>

                        {/* Vertical Divider - not after last item */}
                        {index < kpis.length - 1 && (
                            <div
                                style={{
                                    width: '1px',
                                    background: 'var(--ds-border-secondary)',
                                    alignSelf: 'stretch',
                                }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    )
}

export default KpiStripCard
