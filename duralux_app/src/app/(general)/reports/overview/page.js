import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiUsers, FiDollarSign, FiCalendar, FiPhone, FiTrendingUp, FiHeart } from 'react-icons/fi'

const stats = [
    { title: 'Total Members', value: '1,247', change: '+12%', icon: FiUsers, color: 'primary' },
    { title: 'Weekly Attendance', value: '856', change: '+8%', icon: FiCalendar, color: 'info' },
    { title: 'Monthly Giving', value: '$48,200', change: '+15%', icon: FiDollarSign, color: 'success' },
    { title: 'Grace AI Calls', value: '312', change: '+23%', icon: FiPhone, color: 'warning' },
    { title: 'New Visitors', value: '45', change: '+18%', icon: FiTrendingUp, color: 'secondary' },
    { title: 'Prayer Requests', value: '78', change: '+5%', icon: FiHeart, color: 'danger' },
]

const ReportsOverviewPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Reports Overview</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/reports/overview">Reports</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Overview</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    {stats.map((stat, index) => (
                        <div key={index} className='col-xl-4 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between'>
                                        <div>
                                            <p className='text-muted fs-12 mb-1'>{stat.title}</p>
                                            <h3 className='fw-bold mb-0'>{stat.value}</h3>
                                            <span className='badge bg-soft-success text-success mt-2'>{stat.change} vs last month</span>
                                        </div>
                                        <div className={`wd-50 ht-50 bg-soft-${stat.color} text-${stat.color} rounded-circle d-flex align-items-center justify-content-center`}>
                                            <stat.icon size={24} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className='row'>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Attendance Trend</h5>
                            </div>
                            <div className='card-body'>
                                <div className='text-center py-5'>
                                    <div className='bg-light rounded p-4'>
                                        <FiCalendar size={48} className='text-muted mb-3' />
                                        <p className='text-muted mb-0'>Attendance chart placeholder</p>
                                        <p className='text-muted fs-12'>Chart will be displayed here</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Giving Trend</h5>
                            </div>
                            <div className='card-body'>
                                <div className='text-center py-5'>
                                    <div className='bg-light rounded p-4'>
                                        <FiDollarSign size={48} className='text-muted mb-3' />
                                        <p className='text-muted mb-0'>Giving chart placeholder</p>
                                        <p className='text-muted fs-12'>Chart will be displayed here</p>
                                    </div>
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

export default ReportsOverviewPage
