import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import Link from 'next/link'
import { FiPlus, FiFilter, FiSettings, FiUsers } from 'react-icons/fi'

const churches = [
    { id: 1, name: 'Fellowship Church', city: 'Springfield, IL', plan: 'Pro', members: 1247, status: 'Active', created: 'Jan 2023' },
    { id: 2, name: 'Grace Community', city: 'Chicago, IL', plan: 'Pro', members: 856, status: 'Active', created: 'Mar 2023' },
    { id: 3, name: 'New Hope Chapel', city: 'Peoria, IL', plan: 'Starter', members: 234, status: 'Active', created: 'Jun 2023' },
    { id: 4, name: 'Living Word Church', city: 'Naperville, IL', plan: 'Pro', members: 1523, status: 'Active', created: 'Sep 2023' },
    { id: 5, name: 'Cornerstone Baptist', city: 'Rockford, IL', plan: 'Starter', members: 412, status: 'Trial', created: 'Jan 2025' },
    { id: 6, name: 'Christ Church', city: 'Champaign, IL', plan: 'Pro', members: 678, status: 'Suspended', created: 'Feb 2024' },
]

const AdminChurchesPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Churches</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/admin/churches">Admin</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Churches</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <Link href="/admin/churches/new" className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Church</Link>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-primary mb-0'>6</h3>
                                <p className='text-muted fs-12 mb-0'>Total Churches</p>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-success mb-0'>5</h3>
                                <p className='text-muted fs-12 mb-0'>Active</p>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-info mb-0'>4,950</h3>
                                <p className='text-muted fs-12 mb-0'>Total Members</p>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-warning mb-0'>$495</h3>
                                <p className='text-muted fs-12 mb-0'>Monthly Revenue</p>
                            </div>
                        </div>
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
                                                <th>Church Name</th>
                                                <th>Location</th>
                                                <th>Plan</th>
                                                <th>Members</th>
                                                <th>Status</th>
                                                <th>Created</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {churches.map((church) => (
                                                <tr key={church.id}>
                                                    <td className='fw-semibold'>{church.name}</td>
                                                    <td>{church.city}</td>
                                                    <td><span className={`badge bg-soft-${church.plan === 'Pro' ? 'primary' : 'secondary'}`}>{church.plan}</span></td>
                                                    <td><FiUsers size={14} className='me-1' />{church.members}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${church.status === 'Active' ? 'success' : church.status === 'Trial' ? 'info' : 'danger'}`}>
                                                            {church.status}
                                                        </span>
                                                    </td>
                                                    <td>{church.created}</td>
                                                    <td>
                                                        <button className='btn btn-sm btn-light'><FiSettings size={14} /> Manage</button>
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

export default AdminChurchesPage
