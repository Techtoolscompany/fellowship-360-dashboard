import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiFilter, FiDownload, FiDollarSign } from 'react-icons/fi'

const donations = [
    { id: 1, date: 'Jan 25, 2025', donor: 'Robert Brown', amount: '$250.00', fund: 'General', method: 'Online', status: 'Completed' },
    { id: 2, date: 'Jan 25, 2025', donor: 'Sarah Johnson', amount: '$100.00', fund: 'Building Fund', method: 'Online', status: 'Completed' },
    { id: 3, date: 'Jan 24, 2025', donor: 'Michael Davis', amount: '$75.00', fund: 'General', method: 'Check', status: 'Completed' },
    { id: 4, date: 'Jan 24, 2025', donor: 'Anonymous', amount: '$500.00', fund: 'Missions', method: 'Cash', status: 'Completed' },
    { id: 5, date: 'Jan 23, 2025', donor: 'Emily White', amount: '$150.00', fund: 'General', method: 'Online', status: 'Completed' },
    { id: 6, date: 'Jan 23, 2025', donor: 'David Wilson', amount: '$200.00', fund: 'Youth Ministry', method: 'Online', status: 'Pending' },
    { id: 7, date: 'Jan 22, 2025', donor: 'Jennifer Martinez', amount: '$50.00', fund: 'Benevolence', method: 'Cash', status: 'Completed' },
]

const summaryStats = [
    { title: 'This Week', amount: '$12,450', change: '+15%' },
    { title: 'This Month', amount: '$48,200', change: '+8%' },
    { title: 'YTD', amount: '$48,200', change: '+12%' },
]

const DonationsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Donations</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/giving/donations">Giving</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Donations</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-outline-secondary btn-sm"><FiDownload size={14} className="me-1" /> Export</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    {summaryStats.map((stat, index) => (
                        <div key={index} className='col-md-4'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between'>
                                        <div>
                                            <p className='text-muted fs-12 mb-1'>{stat.title}</p>
                                            <h4 className='fw-bold mb-0'>{stat.amount}</h4>
                                            <span className='badge bg-soft-success text-success'>{stat.change}</span>
                                        </div>
                                        <div className='wd-40 ht-40 bg-soft-success text-success rounded-circle d-flex align-items-center justify-content-center'>
                                            <FiDollarSign size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Donor</th>
                                                <th>Amount</th>
                                                <th>Fund</th>
                                                <th>Method</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {donations.map((donation) => (
                                                <tr key={donation.id}>
                                                    <td>{donation.date}</td>
                                                    <td className='fw-semibold'>{donation.donor}</td>
                                                    <td className='text-success fw-semibold'>{donation.amount}</td>
                                                    <td><span className='badge bg-soft-primary'>{donation.fund}</span></td>
                                                    <td>{donation.method}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${donation.status === 'Completed' ? 'success' : 'warning'}`}>
                                                            {donation.status}
                                                        </span>
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

export default DonationsPage
