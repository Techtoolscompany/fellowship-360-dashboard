'use client'
import React from 'react'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

const AppointmentsCard = () => {
    const data = {
        today: 4,
        thisWeek: 18,
        pendingConfirmation: 2,
        nextUp: { time: '2:30 PM', contact: 'Sarah Johnson', type: 'Counseling' }
    }

    return (
        <div className="col-xxl-3 col-lg-6">
            <div
                className="card h-100"
                style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                    minHeight: '180px',
                }}
            >
                <div className="card-body p-4 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <span style={{ fontSize: '28px' }}>📅</span>
                        {data.pendingConfirmation > 0 && (
                            <span
                                style={{
                                    fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                                    borderRadius: '360px', background: '#f59e0b', color: '#fff',
                                }}
                            >
                                {data.pendingConfirmation} pending
                            </span>
                        )}
                    </div>
                    
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#3730a3', marginBottom: '12px' }}>
                        Appointments
                    </h3>
                    
                    <div className="d-flex gap-4 mb-3">
                        <div>
                            <p className="mb-0" style={{ fontSize: '24px', fontWeight: 700, color: '#3730a3' }}>{data.today}</p>
                            <span style={{ fontSize: '11px', color: '#4338ca' }}>Today</span>
                        </div>
                        <div>
                            <p className="mb-0" style={{ fontSize: '24px', fontWeight: 700, color: '#3730a3' }}>{data.thisWeek}</p>
                            <span style={{ fontSize: '11px', color: '#4338ca' }}>This Week</span>
                        </div>
                    </div>

                    {data.nextUp && (
                        <div 
                            className="p-2 mb-2"
                            style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '8px', fontSize: '11px' }}
                        >
                            <span style={{ color: '#4338ca', fontWeight: 600 }}>Next: </span>
                            <span style={{ color: '#3730a3' }}>{data.nextUp.time} - {data.nextUp.contact}</span>
                        </div>
                    )}
                    
                    <Link 
                        href="/scheduling/appointments" 
                        className="d-flex align-items-center gap-1 mt-auto"
                        style={{ fontSize: '13px', fontWeight: 600, color: '#3730a3', textDecoration: 'none' }}
                    >
                        View All <FiArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default AppointmentsCard
