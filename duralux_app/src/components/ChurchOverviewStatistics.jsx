'use client'
import React from 'react'
import { FiMoreVertical, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'
import { churchStatisticsData } from '@/utils/fackData/churchStatisticsData'
import getIcon from '@/utils/getIcon'
import Link from 'next/link'

const ChurchOverviewStatistics = () => {
    return (
        <>
            {
                churchStatisticsData.map(({ id, completed_number, progress, progress_info, title, total_number, icon }, index) => {
                    const isPositiveTrend = progress_info && progress_info.includes('+')
                    const progressPercent = parseInt(progress) || 0
                    
                    return (
                        <div key={id} className="col-xxl-3 col-md-6">
                            <div 
                                className="card stretch stretch-full"
                                style={{
                                    borderRadius: '16px',
                                    border: '1px solid #f5f5f5',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                                }}
                            >
                                <div className="card-body" style={{ padding: '24px' }}>
                                    <div className="d-flex align-items-start justify-content-between mb-3">
                                        <div className="d-flex gap-3 align-items-center">
                                            <div 
                                                style={{
                                                    width: '52px',
                                                    height: '52px',
                                                    borderRadius: '12px',
                                                    background: index % 2 === 0 ? 'linear-gradient(135deg, #c8f542 0%, #a8d435 100%)' : '#f5f5f5',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: index % 2 === 0 ? '#171717' : '#525252',
                                                }}
                                            >
                                                {React.cloneElement(getIcon(icon), { size: 22 })}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '26px', fontWeight: 700, color: '#171717', lineHeight: 1.2 }}>
                                                    <span>{completed_number ? completed_number + "/" : ""}</span>
                                                    <span>{total_number}</span>
                                                </div>
                                                <h3 style={{ fontSize: '13px', fontWeight: 500, color: '#737373', margin: 0 }}>{title}</h3>
                                            </div>
                                        </div>
                                        <button 
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                border: '1px solid #e5e5e5',
                                                background: 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: '#a3a3a3',
                                            }}
                                        >
                                            <FiMoreVertical size={16} />
                                        </button>
                                    </div>
                                    <div style={{ paddingTop: '16px', borderTop: '1px solid #f5f5f5' }}>
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <span style={{ fontSize: '12px', color: '#a3a3a3' }}>{title}</span>
                                            <div className="d-flex align-items-center gap-2">
                                                <span 
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        background: isPositiveTrend ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                        color: isPositiveTrend ? '#22c55e' : '#ef4444',
                                                    }}
                                                >
                                                    {isPositiveTrend ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
                                                    {progress_info}
                                                </span>
                                                <span style={{ fontSize: '12px', color: '#a3a3a3' }}>({progress})</span>
                                            </div>
                                        </div>
                                        <div 
                                            style={{
                                                height: '6px',
                                                borderRadius: '100px',
                                                background: '#f5f5f5',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div 
                                                style={{
                                                    height: '100%',
                                                    width: progress,
                                                    borderRadius: '100px',
                                                    background: 'linear-gradient(90deg, #c8f542, #a8d435)',
                                                    transition: 'width 0.5s ease',
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })
            }
        </>
    )
}

export default ChurchOverviewStatistics
