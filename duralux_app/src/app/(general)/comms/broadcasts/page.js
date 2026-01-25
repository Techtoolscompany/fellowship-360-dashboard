import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiMail, FiMessageSquare, FiSend, FiClock } from 'react-icons/fi'

const broadcasts = [
    { id: 1, title: 'Weekly Newsletter - Jan 26', type: 'email', recipients: 847, sent: 'Jan 26, 2025', status: 'sent', opens: '68%' },
    { id: 2, title: 'Sunday Service Reminder', type: 'sms', recipients: 1024, sent: 'Jan 25, 2025', status: 'sent', opens: '-' },
    { id: 3, title: 'Youth Event Announcement', type: 'email', recipients: 89, sent: 'Jan 24, 2025', status: 'sent', opens: '72%' },
    { id: 4, title: 'Prayer Meeting Invite', type: 'email', recipients: 312, scheduled: 'Jan 28, 2025', status: 'scheduled', opens: '-' },
    { id: 5, title: 'Volunteer Appreciation', type: 'sms', recipients: 124, scheduled: 'Jan 30, 2025', status: 'draft', opens: '-' },
]

const BroadcastsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Broadcasts</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/comms/conversations">Comms</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Broadcasts</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Create Broadcast</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Title</th>
                                                <th>Type</th>
                                                <th>Recipients</th>
                                                <th>Date</th>
                                                <th>Status</th>
                                                <th>Opens</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {broadcasts.map((broadcast) => (
                                                <tr key={broadcast.id}>
                                                    <td className='fw-semibold'>{broadcast.title}</td>
                                                    <td>
                                                        {broadcast.type === 'email' ? (
                                                            <span className='badge bg-soft-primary text-primary'><FiMail size={12} className='me-1' />Email</span>
                                                        ) : (
                                                            <span className='badge bg-soft-info text-info'><FiMessageSquare size={12} className='me-1' />SMS</span>
                                                        )}
                                                    </td>
                                                    <td>{broadcast.recipients}</td>
                                                    <td>{broadcast.sent || broadcast.scheduled}</td>
                                                    <td>
                                                        {broadcast.status === 'sent' && <span className='badge bg-soft-success text-success'><FiSend size={12} className='me-1' />Sent</span>}
                                                        {broadcast.status === 'scheduled' && <span className='badge bg-soft-warning text-warning'><FiClock size={12} className='me-1' />Scheduled</span>}
                                                        {broadcast.status === 'draft' && <span className='badge bg-soft-secondary text-secondary'>Draft</span>}
                                                    </td>
                                                    <td>{broadcast.opens}</td>
                                                    <td>
                                                        <button className='btn btn-sm btn-light'>View</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}

export default BroadcastsPage
