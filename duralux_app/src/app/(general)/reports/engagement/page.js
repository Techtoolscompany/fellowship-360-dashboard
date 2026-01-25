import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiDownload, FiTrendingUp, FiUsers, FiMessageSquare, FiPhone } from 'react-icons/fi'

const engagementScores = [
    { segment: 'Members', score: 78, trend: '+5%', contacts: 847, active: 645 },
    { segment: 'Regular Attenders', score: 65, trend: '+8%', contacts: 234, active: 178 },
    { segment: 'Visitors', score: 42, trend: '+12%', contacts: 156, active: 89 },
    { segment: 'New Believers', score: 85, trend: '+3%', contacts: 23, active: 21 },
    { segment: 'Youth', score: 71, trend: '+10%', contacts: 89, active: 72 },
]

const engagementMetrics = [
    { metric: 'Email Open Rate', value: '68%', change: '+5%' },
    { metric: 'SMS Response Rate', value: '82%', change: '+8%' },
    { metric: 'Event Attendance Rate', value: '45%', change: '+3%' },
    { metric: 'Small Group Participation', value: '34%', change: '+7%' },
]

const EngagementPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Engagement Report</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/reports/overview">Reports</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Engagement</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-outline-secondary btn-sm"><FiDownload size={14} className="me-1" /> Export</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    {engagementMetrics.map((metric, index) => (
                        <div key={index} className='col-md-3'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <p className='text-muted fs-12 mb-1'>{metric.metric}</p>
                                    <h3 className='fw-bold mb-0'>{metric.value}</h3>
                                    <span className='badge bg-soft-success text-success'>{metric.change}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Engagement by Segment</h5>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Segment</th>
                                                <th>Engagement Score</th>
                                                <th>Trend</th>
                                                <th>Total Contacts</th>
                                                <th>Active Contacts</th>
                                                <th>Activity Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {engagementScores.map((row, index) => (
                                                <tr key={index}>
                                                    <td className='fw-semibold'>{row.segment}</td>
                                                    <td>
                                                        <div className='d-flex align-items-center'>
                                                            <div className='progress flex-grow-1 me-2' style={{height: '8px'}}>
                                                                <div 
                                                                    className={`progress-bar bg-${row.score >= 70 ? 'success' : row.score >= 50 ? 'warning' : 'danger'}`} 
                                                                    style={{width: `${row.score}%`}}
                                                                ></div>
                                                            </div>
                                                            <span className='fw-semibold'>{row.score}%</span>
                                                        </div>
                                                    </td>
                                                    <td><span className='badge bg-soft-success text-success'><FiTrendingUp size={12} className='me-1' />{row.trend}</span></td>
                                                    <td>{row.contacts}</td>
                                                    <td>{row.active}</td>
                                                    <td>{Math.round(row.active / row.contacts * 100)}%</td>
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

export default EngagementPage
