'use client'
import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPhone, FiClock, FiTarget, FiCheck, FiPlus, FiUser } from 'react-icons/fi'
import { useParams } from 'next/navigation'

const callDetails = {
    contact: 'Sarah Johnson',
    dateTime: 'January 25, 2025 at 10:30 AM',
    duration: '4 minutes 32 seconds',
    intent: 'Follow-up',
    outcome: 'Connected',
    sentiment: 'Positive',
    caller: 'Grace AI',
}

const transcript = [
    { speaker: 'Grace AI', text: 'Hi Sarah, this is Grace calling from Fellowship Church. How are you doing today?' },
    { speaker: 'Sarah', text: 'Oh hi! I am doing well, thanks for checking in.' },
    { speaker: 'Grace AI', text: 'Wonderful to hear! I wanted to follow up after your visit last Sunday. Did you enjoy the service?' },
    { speaker: 'Sarah', text: 'Yes, it was great! Everyone was so welcoming. I especially loved the worship music.' },
    { speaker: 'Grace AI', text: 'That is so great to hear! Is there anything we can help you with or any questions you have about our church?' },
    { speaker: 'Sarah', text: 'Actually, I was wondering about your small groups. How do I join one?' },
    { speaker: 'Grace AI', text: 'Great question! We have several small groups that meet throughout the week. I can have someone from our connections team reach out to help you find the perfect fit. Would that work for you?' },
    { speaker: 'Sarah', text: 'Yes, that would be perfect! Thank you so much.' },
    { speaker: 'Grace AI', text: 'Wonderful! Someone will be in touch soon. We look forward to seeing you again. Have a blessed day!' },
    { speaker: 'Sarah', text: 'You too, bye!' },
]

const GraceCallDetailPage = () => {
    const params = useParams()
    
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Call Details</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/grace/calls">Grace AI</a></li>
                                <li className="breadcrumb-item"><a href="/grace/calls">Calls</a></li>
                                <li className="breadcrumb-item active" aria-current="page">{callDetails.contact}</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Create Follow-up Task</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Call Metadata</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <p className='text-muted fs-12 mb-1'>Contact</p>
                                    <p className='fw-semibold mb-0'><FiUser size={14} className='me-2' />{callDetails.contact}</p>
                                </div>
                                <div className='mb-3'>
                                    <p className='text-muted fs-12 mb-1'>Date & Time</p>
                                    <p className='fw-semibold mb-0'><FiPhone size={14} className='me-2' />{callDetails.dateTime}</p>
                                </div>
                                <div className='mb-3'>
                                    <p className='text-muted fs-12 mb-1'>Duration</p>
                                    <p className='fw-semibold mb-0'><FiClock size={14} className='me-2' />{callDetails.duration}</p>
                                </div>
                                <div className='mb-3'>
                                    <p className='text-muted fs-12 mb-1'>Intent</p>
                                    <p className='mb-0'><FiTarget size={14} className='me-2' /><span className='badge bg-soft-primary text-primary'>{callDetails.intent}</span></p>
                                </div>
                                <div className='mb-3'>
                                    <p className='text-muted fs-12 mb-1'>Outcome</p>
                                    <p className='mb-0'><FiCheck size={14} className='me-2' /><span className='badge bg-soft-success text-success'>{callDetails.outcome}</span></p>
                                </div>
                                <div className='mb-0'>
                                    <p className='text-muted fs-12 mb-1'>Sentiment</p>
                                    <p className='mb-0'><span className='badge bg-soft-success text-success'>{callDetails.sentiment}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Transcript</h5>
                            </div>
                            <div className='card-body'>
                                {transcript.map((line, index) => (
                                    <div key={index} className={`mb-3 ${line.speaker === 'Grace AI' ? 'ps-0' : 'ps-4'}`}>
                                        <p className='fw-semibold fs-12 mb-1 text-primary'>{line.speaker}</p>
                                        <p className={`mb-0 p-2 rounded ${line.speaker === 'Grace AI' ? 'bg-light' : 'bg-soft-primary'}`}>
                                            {line.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}

export default GraceCallDetailPage
