'use client'
import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiHeart, FiMessageSquare, FiUser, FiCalendar, FiCheck } from 'react-icons/fi'
import { useParams } from 'next/navigation'

const prayerRequest = {
    id: 1,
    submitter: 'Sarah Johnson',
    category: 'Health',
    summary: 'Prayer for mother recovering from surgery',
    details: 'My mother had major surgery last week and is in recovery. Please pray for her complete healing, for the doctors and nurses caring for her, and for our family as we support her through this time. She has been such a pillar of faith for our family, and we know God is faithful.',
    submitted: 'January 25, 2025',
    status: 'Active',
    prayerCount: 12,
    isPrivate: false,
}

const updates = [
    { date: 'Jan 26, 2025', message: 'Mom is doing much better today! The doctors are pleased with her progress.' },
    { date: 'Jan 25, 2025', message: 'Initial request submitted. Surgery went well, now in recovery.' },
]

const prayerTeam = [
    { name: 'Pastor Mike', prayedAt: '2 hours ago' },
    { name: 'Sarah L.', prayedAt: '4 hours ago' },
    { name: 'John D.', prayedAt: '6 hours ago' },
]

const PrayerRequestDetailPage = () => {
    const params = useParams()
    
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Prayer Request</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/care/prayer-requests">Prayer & Care</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Details</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-success btn-sm"><FiCheck size={14} className="me-1" /> Mark as Answered</button>
                        <button className="btn btn-primary btn-sm"><FiHeart size={14} className="me-1" /> I Prayed</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <div className='d-flex justify-content-between align-items-center'>
                                    <h5 className='card-title mb-0'>{prayerRequest.summary}</h5>
                                    <span className={`badge bg-soft-${prayerRequest.status === 'Active' ? 'success' : 'primary'}`}>
                                        {prayerRequest.status}
                                    </span>
                                </div>
                            </div>
                            <div className='card-body'>
                                <p className='mb-4'>{prayerRequest.details}</p>
                                <div className='d-flex gap-4 text-muted fs-12'>
                                    <span><FiUser size={14} className='me-1' /> {prayerRequest.submitter}</span>
                                    <span><FiCalendar size={14} className='me-1' /> {prayerRequest.submitted}</span>
                                    <span><FiHeart size={14} className='me-1 text-danger' /> {prayerRequest.prayerCount} prayers</span>
                                </div>
                            </div>
                        </div>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Updates</h5>
                            </div>
                            <div className='card-body'>
                                {updates.map((update, index) => (
                                    <div key={index} className='d-flex align-items-start mb-3 pb-3 border-bottom'>
                                        <div className='flex-grow-1'>
                                            <p className='mb-1'>{update.message}</p>
                                            <small className='text-muted'>{update.date}</small>
                                        </div>
                                    </div>
                                ))}
                                <div className='mt-3'>
                                    <textarea className='form-control' rows='2' placeholder='Add an update...'></textarea>
                                    <button className='btn btn-primary btn-sm mt-2'>Post Update</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Prayer Team</h5>
                            </div>
                            <div className='card-body'>
                                {prayerTeam.map((member, index) => (
                                    <div key={index} className='d-flex align-items-center mb-3'>
                                        <div className='avatar avatar-sm bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center' style={{width: '32px', height: '32px'}}>
                                            {member.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <p className='mb-0 fs-13 fw-semibold'>{member.name}</p>
                                            <small className='text-muted'>Prayed {member.prayedAt}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Send Encouragement</h5>
                            </div>
                            <div className='card-body'>
                                <textarea className='form-control' rows='3' placeholder='Write a message of encouragement...'></textarea>
                                <button className='btn btn-outline-primary btn-sm mt-2 w-100'>
                                    <FiMessageSquare size={14} className='me-1' /> Send Message
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}

export default PrayerRequestDetailPage
