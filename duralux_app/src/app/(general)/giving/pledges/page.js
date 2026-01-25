import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiFilter } from 'react-icons/fi'

const pledges = [
    { id: 1, donor: 'Robert Brown', campaign: 'Building Fund 2025', pledged: '$5,000', fulfilled: '$2,500', remaining: '$2,500', dueDate: 'Dec 31, 2025', status: 'On Track' },
    { id: 2, donor: 'Sarah Johnson', campaign: 'Building Fund 2025', pledged: '$10,000', fulfilled: '$6,000', remaining: '$4,000', dueDate: 'Dec 31, 2025', status: 'On Track' },
    { id: 3, donor: 'Michael Davis', campaign: 'Missions 2025', pledged: '$2,400', fulfilled: '$600', remaining: '$1,800', dueDate: 'Dec 31, 2025', status: 'On Track' },
    { id: 4, donor: 'Emily White', campaign: 'Building Fund 2025', pledged: '$3,000', fulfilled: '$500', remaining: '$2,500', dueDate: 'Dec 31, 2025', status: 'Behind' },
    { id: 5, donor: 'David Wilson', campaign: 'Youth Ministry', pledged: '$1,200', fulfilled: '$1,200', remaining: '$0', dueDate: 'Dec 31, 2024', status: 'Completed' },
]

const PledgesPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Pledges</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/giving/donations">Giving</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Pledges</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> New Pledge</button>
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
                                                <th>Donor</th>
                                                <th>Campaign</th>
                                                <th>Pledged</th>
                                                <th>Fulfilled</th>
                                                <th>Remaining</th>
                                                <th>Due Date</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pledges.map((pledge) => (
                                                <tr key={pledge.id}>
                                                    <td className='fw-semibold'>{pledge.donor}</td>
                                                    <td>{pledge.campaign}</td>
                                                    <td>{pledge.pledged}</td>
                                                    <td className='text-success'>{pledge.fulfilled}</td>
                                                    <td className={pledge.remaining === '$0' ? 'text-muted' : 'text-warning'}>{pledge.remaining}</td>
                                                    <td>{pledge.dueDate}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${pledge.status === 'Completed' ? 'success' : pledge.status === 'On Track' ? 'primary' : 'warning'}`}>
                                                            {pledge.status}
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

export default PledgesPage
