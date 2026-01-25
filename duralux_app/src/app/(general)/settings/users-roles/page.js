import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi'

const users = [
    { id: 1, name: 'Pastor Mike Johnson', email: 'mike.j@church.com', role: 'Admin', status: 'Active', lastLogin: 'Today' },
    { id: 2, name: 'Sarah Lee', email: 'sarah.l@church.com', role: 'Staff', status: 'Active', lastLogin: 'Yesterday' },
    { id: 3, name: 'John Davis', email: 'john.d@church.com', role: 'Staff', status: 'Active', lastLogin: '2 days ago' },
    { id: 4, name: 'Emily Chen', email: 'emily.c@church.com', role: 'Volunteer', status: 'Active', lastLogin: '1 week ago' },
    { id: 5, name: 'Robert Wilson', email: 'robert.w@church.com', role: 'Volunteer', status: 'Inactive', lastLogin: '1 month ago' },
]

const roles = [
    { name: 'Admin', description: 'Full access to all features', users: 1 },
    { name: 'Staff', description: 'Access to most features except billing', users: 2 },
    { name: 'Volunteer', description: 'Limited access to assigned areas', users: 2 },
    { name: 'View Only', description: 'Read-only access to reports', users: 0 },
]

const UsersRolesPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Users & Roles</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/settings/church-profile">Settings</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Users & Roles</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Invite User</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Users</h5>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Role</th>
                                                <th>Status</th>
                                                <th>Last Login</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map((user) => (
                                                <tr key={user.id}>
                                                    <td className='fw-semibold'>{user.name}</td>
                                                    <td>{user.email}</td>
                                                    <td><span className={`badge bg-soft-${user.role === 'Admin' ? 'danger' : user.role === 'Staff' ? 'primary' : 'secondary'}`}>{user.role}</span></td>
                                                    <td><span className={`badge bg-soft-${user.status === 'Active' ? 'success' : 'danger'}`}>{user.status}</span></td>
                                                    <td>{user.lastLogin}</td>
                                                    <td>
                                                        <button className='btn btn-sm btn-light me-1'><FiEdit size={14} /></button>
                                                        <button className='btn btn-sm btn-outline-danger'><FiTrash2 size={14} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header d-flex justify-content-between align-items-center'>
                                <h5 className='card-title mb-0'>Roles</h5>
                                <button className='btn btn-sm btn-outline-primary'><FiPlus size={14} /></button>
                            </div>
                            <div className='card-body p-0'>
                                {roles.map((role, index) => (
                                    <div key={index} className='p-3 border-bottom'>
                                        <div className='d-flex justify-content-between align-items-start'>
                                            <div>
                                                <h6 className='fs-13 fw-semibold mb-1'>{role.name}</h6>
                                                <p className='text-muted fs-12 mb-0'>{role.description}</p>
                                            </div>
                                            <span className='badge bg-soft-primary'>{role.users} users</span>
                                        </div>
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

export default UsersRolesPage
