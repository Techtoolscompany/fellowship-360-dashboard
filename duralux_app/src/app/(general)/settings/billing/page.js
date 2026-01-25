import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiCreditCard, FiDownload } from 'react-icons/fi'

const invoices = [
    { id: 'INV-2025-001', date: 'Jan 1, 2025', amount: '$99.00', status: 'Paid' },
    { id: 'INV-2024-012', date: 'Dec 1, 2024', amount: '$99.00', status: 'Paid' },
    { id: 'INV-2024-011', date: 'Nov 1, 2024', amount: '$99.00', status: 'Paid' },
    { id: 'INV-2024-010', date: 'Oct 1, 2024', amount: '$99.00', status: 'Paid' },
]

const BillingPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Billing</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/settings/church-profile">Settings</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Billing</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Current Plan</h5>
                            </div>
                            <div className='card-body'>
                                <h4 className='fw-bold text-primary mb-2'>Fellowship 360 Pro</h4>
                                <p className='text-muted mb-3'>$99/month</p>
                                <ul className='list-unstyled'>
                                    <li className='mb-2'>Unlimited contacts</li>
                                    <li className='mb-2'>Grace AI calls (500/mo)</li>
                                    <li className='mb-2'>Email & SMS broadcasts</li>
                                    <li className='mb-2'>All integrations</li>
                                    <li className='mb-2'>Priority support</li>
                                </ul>
                                <button className='btn btn-outline-primary w-100 mt-3'>Upgrade Plan</button>
                            </div>
                        </div>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Payment Method</h5>
                            </div>
                            <div className='card-body'>
                                <div className='d-flex align-items-center mb-3'>
                                    <div className='wd-40 ht-40 bg-light rounded d-flex align-items-center justify-content-center me-3'>
                                        <FiCreditCard size={20} />
                                    </div>
                                    <div>
                                        <p className='fw-semibold mb-0'>Visa ending in 4242</p>
                                        <small className='text-muted'>Expires 12/26</small>
                                    </div>
                                </div>
                                <button className='btn btn-outline-secondary btn-sm'>Update Payment Method</button>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Billing History</h5>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Invoice</th>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.map((invoice) => (
                                                <tr key={invoice.id}>
                                                    <td className='fw-semibold'>{invoice.id}</td>
                                                    <td>{invoice.date}</td>
                                                    <td>{invoice.amount}</td>
                                                    <td><span className='badge bg-soft-success'>{invoice.status}</span></td>
                                                    <td>
                                                        <button className='btn btn-sm btn-light'><FiDownload size={14} /> Download</button>
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

export default BillingPage
