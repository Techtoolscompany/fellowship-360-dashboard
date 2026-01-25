import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import Link from 'next/link'
import { FiFilter, FiDownload, FiDollarSign } from 'react-icons/fi'

const donors = [
    { id: 1, name: 'Robert Brown', totalGiven: '$5,250', thisYear: '$5,250', lastGift: 'Jan 25, 2025', frequency: 'Weekly' },
    { id: 2, name: 'Sarah Johnson', totalGiven: '$12,400', thisYear: '$400', lastGift: 'Jan 25, 2025', frequency: 'Monthly' },
    { id: 3, name: 'Michael Davis', totalGiven: '$3,600', thisYear: '$300', lastGift: 'Jan 24, 2025', frequency: 'Monthly' },
    { id: 4, name: 'Emily White', totalGiven: '$8,750', thisYear: '$450', lastGift: 'Jan 23, 2025', frequency: 'Weekly' },
    { id: 5, name: 'David Wilson', totalGiven: '$4,200', thisYear: '$200', lastGift: 'Jan 23, 2025', frequency: 'Monthly' },
    { id: 6, name: 'Jennifer Martinez', totalGiven: '$1,850', thisYear: '$150', lastGift: 'Jan 22, 2025', frequency: 'Occasional' },
]

const DonorsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Donors</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/giving/donations">Giving</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Donors</li>
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
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Total Given</th>
                                                <th>This Year</th>
                                                <th>Last Gift</th>
                                                <th>Frequency</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {donors.map((donor) => (
                                                <tr key={donor.id}>
                                                    <td>
                                                        <Link href={`/giving/donors/${donor.id}`} className="text-primary fw-semibold">
                                                            {donor.name}
                                                        </Link>
                                                    </td>
                                                    <td className='text-success fw-semibold'>{donor.totalGiven}</td>
                                                    <td>{donor.thisYear}</td>
                                                    <td>{donor.lastGift}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${donor.frequency === 'Weekly' ? 'success' : donor.frequency === 'Monthly' ? 'primary' : 'secondary'}`}>
                                                            {donor.frequency}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <Link href={`/giving/donors/${donor.id}`} className="btn btn-sm btn-light">View</Link>
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

export default DonorsPage
