import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import Link from 'next/link'
import { FiPlus, FiFilter, FiHeart } from 'react-icons/fi'

const prayerRequests = [
    { id: 1, submitter: 'Sarah Johnson', category: 'Health', summary: 'Prayer for mother recovering from surgery', submitted: 'Jan 25, 2025', status: 'Active', prayerCount: 12 },
    { id: 2, submitter: 'Michael Davis', category: 'Family', summary: 'Unity and peace in our household', submitted: 'Jan 24, 2025', status: 'Active', prayerCount: 8 },
    { id: 3, submitter: 'Emily White', category: 'Career', summary: 'Guidance for job interview next week', submitted: 'Jan 23, 2025', status: 'Active', prayerCount: 15 },
    { id: 4, submitter: 'Robert Brown', category: 'Health', summary: 'Healing for chronic back pain', submitted: 'Jan 22, 2025', status: 'Answered', prayerCount: 23 },
    { id: 5, submitter: 'Jennifer Martinez', category: 'Spiritual', summary: 'Deeper relationship with God', submitted: 'Jan 21, 2025', status: 'Active', prayerCount: 18 },
    { id: 6, submitter: 'Anonymous', category: 'Other', summary: 'Strength during difficult times', submitted: 'Jan 20, 2025', status: 'Active', prayerCount: 31 },
]

const PrayerRequestsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Prayer Requests</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/care/prayer-requests">Prayer & Care</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Prayer Requests</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Request</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    {prayerRequests.map((request) => (
                        <div key={request.id} className='col-lg-4 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex justify-content-between align-items-start mb-3'>
                                        <span className={`badge bg-soft-${request.category === 'Health' ? 'danger' : request.category === 'Family' ? 'info' : request.category === 'Career' ? 'warning' : request.category === 'Spiritual' ? 'primary' : 'secondary'}`}>
                                            {request.category}
                                        </span>
                                        <span className={`badge bg-soft-${request.status === 'Active' ? 'success' : 'primary'}`}>
                                            {request.status}
                                        </span>
                                    </div>
                                    <h6 className='fw-bold mb-2'>{request.summary}</h6>
                                    <p className='text-muted fs-12 mb-3'>Submitted by {request.submitter} on {request.submitted}</p>
                                    <div className='d-flex justify-content-between align-items-center'>
                                        <span className='text-muted fs-12'>
                                            <FiHeart size={14} className='me-1 text-danger' /> {request.prayerCount} prayers
                                        </span>
                                        <Link href={`/care/prayer-requests/${request.id}`} className='btn btn-sm btn-light'>View</Link>
                                    </div>
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

export default PrayerRequestsPage
