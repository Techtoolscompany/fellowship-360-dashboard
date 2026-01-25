import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import Link from 'next/link'
import { FiFilter, FiPhone, FiCheck, FiX } from 'react-icons/fi'

const callsData = [
    { id: 1, dateTime: 'Jan 25, 2025 10:30 AM', caller: 'Grace AI', contact: 'Sarah Johnson', intent: 'Follow-up', outcome: 'Connected', duration: '4:32', followUp: true },
    { id: 2, dateTime: 'Jan 25, 2025 9:15 AM', caller: 'Grace AI', contact: 'Michael Davis', intent: 'Welcome', outcome: 'Voicemail', duration: '1:15', followUp: true },
    { id: 3, dateTime: 'Jan 24, 2025 3:45 PM', caller: 'Grace AI', contact: 'Emily White', intent: 'Prayer Check-in', outcome: 'Connected', duration: '6:20', followUp: false },
    { id: 4, dateTime: 'Jan 24, 2025 2:00 PM', caller: 'Grace AI', contact: 'Robert Brown', intent: 'Event Reminder', outcome: 'Connected', duration: '2:45', followUp: false },
    { id: 5, dateTime: 'Jan 24, 2025 11:30 AM', caller: 'Grace AI', contact: 'Jennifer Martinez', intent: 'Welcome', outcome: 'No Answer', duration: '0:45', followUp: true },
    { id: 6, dateTime: 'Jan 23, 2025 4:00 PM', caller: 'Grace AI', contact: 'David Wilson', intent: 'Follow-up', outcome: 'Connected', duration: '5:10', followUp: false },
]

const GraceCallsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Grace AI Calls</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/grace/calls">Grace AI</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Calls</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filters</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-3'>
                    <div className='col-md-3'>
                        <select className='form-select form-select-sm'>
                            <option value="">All Intents</option>
                            <option value="welcome">Welcome</option>
                            <option value="follow-up">Follow-up</option>
                            <option value="prayer">Prayer Check-in</option>
                            <option value="event">Event Reminder</option>
                        </select>
                    </div>
                    <div className='col-md-3'>
                        <select className='form-select form-select-sm'>
                            <option value="">All Outcomes</option>
                            <option value="connected">Connected</option>
                            <option value="voicemail">Voicemail</option>
                            <option value="no-answer">No Answer</option>
                        </select>
                    </div>
                    <div className='col-md-3'>
                        <input type='date' className='form-control form-control-sm' placeholder='Start Date' />
                    </div>
                    <div className='col-md-3'>
                        <input type='date' className='form-control form-control-sm' placeholder='End Date' />
                    </div>
                </div>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Date/Time</th>
                                                <th>Contact</th>
                                                <th>Intent</th>
                                                <th>Outcome</th>
                                                <th>Duration</th>
                                                <th>Follow-up Needed</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {callsData.map((call) => (
                                                <tr key={call.id}>
                                                    <td>{call.dateTime}</td>
                                                    <td>
                                                        <Link href={`/grace/calls/${call.id}`} className="text-primary fw-semibold">
                                                            {call.contact}
                                                        </Link>
                                                    </td>
                                                    <td><span className='badge bg-soft-primary text-primary'>{call.intent}</span></td>
                                                    <td>
                                                        <span className={`badge bg-soft-${call.outcome === 'Connected' ? 'success' : call.outcome === 'Voicemail' ? 'warning' : 'secondary'}`}>
                                                            {call.outcome}
                                                        </span>
                                                    </td>
                                                    <td>{call.duration}</td>
                                                    <td>
                                                        {call.followUp ? (
                                                            <span className='text-warning'><FiCheck size={16} /> Yes</span>
                                                        ) : (
                                                            <span className='text-muted'><FiX size={16} /> No</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <Link href={`/grace/calls/${call.id}`} className="btn btn-sm btn-light">
                                                            <FiPhone size={14} /> Details
                                                        </Link>
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

export default GraceCallsPage
