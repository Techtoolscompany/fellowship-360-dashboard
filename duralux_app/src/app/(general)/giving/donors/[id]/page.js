'use client'
import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiDollarSign, FiCalendar, FiMail, FiDownload } from 'react-icons/fi'
import { useParams } from 'next/navigation'

const donorDetails = {
    name: 'Robert Brown',
    email: 'robert.b@email.com',
    phone: '(555) 456-7890',
    totalGiven: '$5,250.00',
    thisYear: '$5,250.00',
    averageGift: '$125.00',
    frequency: 'Weekly',
    memberSince: 'March 2020',
}

const recentDonations = [
    { date: 'Jan 25, 2025', amount: '$250.00', fund: 'General', method: 'Online' },
    { date: 'Jan 18, 2025', amount: '$250.00', fund: 'General', method: 'Online' },
    { date: 'Jan 11, 2025', amount: '$250.00', fund: 'General', method: 'Online' },
    { date: 'Jan 4, 2025', amount: '$250.00', fund: 'General', method: 'Online' },
    { date: 'Dec 28, 2024', amount: '$250.00', fund: 'General', method: 'Online' },
]

const DonorDetailPage = () => {
    const params = useParams()
    
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Donor Profile</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/giving/donors">Donors</a></li>
                                <li className="breadcrumb-item active" aria-current="page">{donorDetails.name}</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-outline-secondary btn-sm"><FiDownload size={14} className="me-1" /> Generate Statement</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Donor Information</h5>
                            </div>
                            <div className='card-body text-center'>
                                <div className='avatar avatar-xl bg-success text-white rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center' style={{width: '80px', height: '80px'}}>
                                    <span className='fs-3'>{donorDetails.name.split(' ').map(n => n[0]).join('')}</span>
                                </div>
                                <h5 className='mb-1'>{donorDetails.name}</h5>
                                <p className='text-muted fs-12 mb-3'>{donorDetails.email}</p>
                                <div className='text-start mt-4'>
                                    <div className='d-flex justify-content-between mb-2'>
                                        <span className='text-muted'>Total Given:</span>
                                        <span className='fw-bold text-success'>{donorDetails.totalGiven}</span>
                                    </div>
                                    <div className='d-flex justify-content-between mb-2'>
                                        <span className='text-muted'>This Year:</span>
                                        <span className='fw-semibold'>{donorDetails.thisYear}</span>
                                    </div>
                                    <div className='d-flex justify-content-between mb-2'>
                                        <span className='text-muted'>Average Gift:</span>
                                        <span>{donorDetails.averageGift}</span>
                                    </div>
                                    <div className='d-flex justify-content-between mb-2'>
                                        <span className='text-muted'>Frequency:</span>
                                        <span className='badge bg-soft-success'>{donorDetails.frequency}</span>
                                    </div>
                                    <div className='d-flex justify-content-between'>
                                        <span className='text-muted'>Member Since:</span>
                                        <span>{donorDetails.memberSince}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Recent Donations</h5>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Fund</th>
                                                <th>Method</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentDonations.map((donation, index) => (
                                                <tr key={index}>
                                                    <td><FiCalendar size={14} className='me-1' />{donation.date}</td>
                                                    <td className='text-success fw-semibold'>{donation.amount}</td>
                                                    <td><span className='badge bg-soft-primary'>{donation.fund}</span></td>
                                                    <td>{donation.method}</td>
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

export default DonorDetailPage
