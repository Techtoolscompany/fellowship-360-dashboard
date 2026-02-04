'use client'
import React from 'react'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

const InquiriesCard = () => {
    const data = {
        new: 8,
        awaitingResponse: 4,
        resolvedToday: 6,
        avgResponseTime: '2.4 hrs'
    }

    return (
        <div className="col-xxl-3 col-lg-6">
            <div
                className="card h-100"
                style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                    minHeight: '180px',
                }}
            >
                <div className="card-body p-4 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <span style={{ fontSize: '28px' }}>💬</span>
                        <span
                            style={{
                                fontSize: '11px', fontWeight: 500, padding: '4px 10px',
                                borderRadius: '360px', background: 'rgba(255,255,255,0.6)', color: '#047857',
                            }}
                        >
                            Avg: {data.avgResponseTime}
                        </span>
                    </div>
                    
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#065f46', marginBottom: '12px' }}>
                        General Inquiries
                    </h3>
                    
                    <div className="d-flex gap-4 mb-3">
                        <div>
                            <p className="mb-0" style={{ fontSize: '24px', fontWeight: 700, color: '#065f46' }}>{data.new}</p>
                            <span style={{ fontSize: '11px', color: '#047857' }}>New</span>
                        </div>
                        <div>
                            <p className="mb-0" style={{ fontSize: '24px', fontWeight: 700, color: '#065f46' }}>{data.awaitingResponse}</p>
                            <span style={{ fontSize: '11px', color: '#047857' }}>Awaiting</span>
                        </div>
                        <div>
                            <p className="mb-0" style={{ fontSize: '24px', fontWeight: 700, color: '#065f46' }}>{data.resolvedToday}</p>
                            <span style={{ fontSize: '11px', color: '#047857' }}>Resolved</span>
                        </div>
                    </div>
                    
                    <Link 
                        href="/comms/conversations" 
                        className="d-flex align-items-center gap-1 mt-auto"
                        style={{ fontSize: '13px', fontWeight: 600, color: '#065f46', textDecoration: 'none' }}
                    >
                        View All <FiArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default InquiriesCard
