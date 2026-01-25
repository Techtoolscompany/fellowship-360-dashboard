import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiRefreshCw, FiCheck, FiClock, FiAlertCircle } from 'react-icons/fi'

const provisioningTasks = [
    { id: 1, church: 'Fellowship Church', task: 'Database Migration', status: 'Completed', started: 'Jan 25, 10:00 AM', completed: 'Jan 25, 10:15 AM' },
    { id: 2, church: 'Grace Community', task: 'Grace AI Setup', status: 'Completed', started: 'Jan 24, 2:00 PM', completed: 'Jan 24, 2:30 PM' },
    { id: 3, church: 'New Hope Chapel', task: 'Initial Data Import', status: 'In Progress', started: 'Jan 25, 11:00 AM', completed: '-' },
    { id: 4, church: 'Cornerstone Baptist', task: 'Account Creation', status: 'Pending', started: '-', completed: '-' },
    { id: 5, church: 'Cornerstone Baptist', task: 'Database Setup', status: 'Pending', started: '-', completed: '-' },
    { id: 6, church: 'Christ Church', task: 'Data Backup', status: 'Failed', started: 'Jan 24, 4:00 PM', completed: '-' },
]

const systemStatus = [
    { name: 'Database Cluster', status: 'Healthy', uptime: '99.99%' },
    { name: 'Grace AI Service', status: 'Healthy', uptime: '99.95%' },
    { name: 'Email Service', status: 'Healthy', uptime: '100%' },
    { name: 'SMS Gateway', status: 'Degraded', uptime: '98.5%' },
]

const ProvisioningPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Provisioning</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/admin/churches">Admin</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Provisioning</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-outline-secondary btn-sm"><FiRefreshCw size={14} className="me-1" /> Refresh</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Provisioning Tasks</h5>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Church</th>
                                                <th>Task</th>
                                                <th>Status</th>
                                                <th>Started</th>
                                                <th>Completed</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {provisioningTasks.map((task) => (
                                                <tr key={task.id}>
                                                    <td className='fw-semibold'>{task.church}</td>
                                                    <td>{task.task}</td>
                                                    <td>
                                                        {task.status === 'Completed' && <span className='badge bg-soft-success text-success'><FiCheck size={12} /> Completed</span>}
                                                        {task.status === 'In Progress' && <span className='badge bg-soft-info text-info'><FiRefreshCw size={12} /> In Progress</span>}
                                                        {task.status === 'Pending' && <span className='badge bg-soft-warning text-warning'><FiClock size={12} /> Pending</span>}
                                                        {task.status === 'Failed' && <span className='badge bg-soft-danger text-danger'><FiAlertCircle size={12} /> Failed</span>}
                                                    </td>
                                                    <td>{task.started}</td>
                                                    <td>{task.completed}</td>
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
                            <div className='card-header'>
                                <h5 className='card-title'>System Status</h5>
                            </div>
                            <div className='card-body p-0'>
                                {systemStatus.map((system, index) => (
                                    <div key={index} className='d-flex justify-content-between align-items-center p-3 border-bottom'>
                                        <div>
                                            <h6 className='fs-13 fw-semibold mb-1'>{system.name}</h6>
                                            <small className='text-muted'>Uptime: {system.uptime}</small>
                                        </div>
                                        <span className={`badge bg-soft-${system.status === 'Healthy' ? 'success' : 'warning'}`}>
                                            {system.status}
                                        </span>
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

export default ProvisioningPage
