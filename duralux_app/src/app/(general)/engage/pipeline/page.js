'use client'
import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiMoreVertical, FiCalendar, FiUser } from 'react-icons/fi'

const pipelineColumns = [
    { id: 'new', title: 'New Visitor', color: 'info' },
    { id: 'attempted', title: 'Attempted', color: 'warning' },
    { id: 'connected', title: 'Connected', color: 'primary' },
    { id: 'scheduled', title: 'Scheduled Visit', color: 'secondary' },
    { id: 'joined', title: 'Joined', color: 'success' },
    { id: 'inactive', title: 'Inactive', color: 'danger' },
]

const pipelineCards = {
    new: [
        { id: 1, name: 'Jennifer Martinez', lastContact: 'Today', owner: 'Pastor Mike', nextAction: 'Jan 28' },
        { id: 2, name: 'Carlos Rodriguez', lastContact: 'Yesterday', owner: 'Sarah L.', nextAction: 'Jan 29' },
    ],
    attempted: [
        { id: 3, name: 'Amanda Chen', lastContact: '2 days ago', owner: 'Pastor Mike', nextAction: 'Jan 27' },
    ],
    connected: [
        { id: 4, name: 'David Kim', lastContact: '3 days ago', owner: 'John D.', nextAction: 'Jan 30' },
        { id: 5, name: 'Lisa Thompson', lastContact: '1 week ago', owner: 'Sarah L.', nextAction: 'Jan 28' },
    ],
    scheduled: [
        { id: 6, name: 'Mark Wilson', lastContact: 'Today', owner: 'Pastor Mike', nextAction: 'Jan 26' },
    ],
    joined: [
        { id: 7, name: 'Rachel Green', lastContact: '2 weeks ago', owner: 'John D.', nextAction: 'Feb 1' },
    ],
    inactive: [
        { id: 8, name: 'Tom Bradley', lastContact: '1 month ago', owner: 'Sarah L.', nextAction: 'Overdue' },
    ],
}

const PipelinePage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Visitor Pipeline</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/engage/pipeline">Engage</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Pipeline</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Visitor</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row' style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '20px' }}>
                    {pipelineColumns.map((column) => (
                        <div key={column.id} className='col-xl-2 col-lg-3 col-md-4' style={{ minWidth: '280px' }}>
                            <div className='card stretch stretch-full'>
                                <div className={`card-header bg-soft-${column.color}`}>
                                    <h6 className='card-title mb-0 fs-13'>
                                        {column.title}
                                        <span className='badge bg-white text-dark ms-2'>{pipelineCards[column.id]?.length || 0}</span>
                                    </h6>
                                </div>
                                <div className='card-body p-2' style={{ minHeight: '400px' }}>
                                    {pipelineCards[column.id]?.map((card) => (
                                        <div key={card.id} className='card mb-2 border'>
                                            <div className='card-body p-3'>
                                                <div className='d-flex justify-content-between align-items-start mb-2'>
                                                    <h6 className='fs-13 fw-semibold mb-0'>{card.name}</h6>
                                                    <FiMoreVertical size={14} className='text-muted' />
                                                </div>
                                                <p className='text-muted fs-11 mb-2'>Last contact: {card.lastContact}</p>
                                                <div className='d-flex justify-content-between align-items-center'>
                                                    <span className='fs-11 text-muted'>
                                                        <FiUser size={12} className='me-1' />{card.owner}
                                                    </span>
                                                    <span className={`fs-11 ${card.nextAction === 'Overdue' ? 'text-danger' : 'text-muted'}`}>
                                                        <FiCalendar size={12} className='me-1' />{card.nextAction}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Footer />
        </>
    )
}

export default PipelinePage
