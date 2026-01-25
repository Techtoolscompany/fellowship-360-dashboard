import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiUsers, FiPhone, FiCalendar, FiDollarSign, FiHeart, FiTarget } from 'react-icons/fi'

const kpiData = [
    { title: 'Total Members', value: '1,247', change: '+12%', icon: FiUsers, color: 'primary' },
    { title: 'New Visitors', value: '38', change: '+8%', icon: FiTarget, color: 'success' },
    { title: 'Grace AI Calls', value: '156', change: '+23%', icon: FiPhone, color: 'info' },
    { title: 'Prayer Requests', value: '24', change: '+5%', icon: FiHeart, color: 'warning' },
    { title: 'Weekly Giving', value: '$12,450', change: '+15%', icon: FiDollarSign, color: 'success' },
    { title: 'Upcoming Events', value: '8', change: '', icon: FiCalendar, color: 'secondary' },
]

const recentActivity = [
    { type: 'visitor', message: 'Sarah Johnson registered as a new visitor', time: '2 hours ago' },
    { type: 'call', message: 'Grace AI completed follow-up call with Mike Davis', time: '3 hours ago' },
    { type: 'prayer', message: 'New prayer request submitted by Emily White', time: '4 hours ago' },
    { type: 'donation', message: 'Online donation received from Robert Brown - $250', time: '5 hours ago' },
    { type: 'event', message: 'Youth Group meeting scheduled for Saturday', time: '6 hours ago' },
    { type: 'member', message: 'John Smith updated contact information', time: '1 day ago' },
]

const HomePage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Dashboard</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Dashboard</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    {kpiData.map((kpi, index) => (
                        <div key={index} className='col-xxl-2 col-lg-4 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between'>
                                        <div>
                                            <p className='fs-12 text-muted mb-1'>{kpi.title}</p>
                                            <h4 className='fw-bold mb-0'>{kpi.value}</h4>
                                            {kpi.change && <span className={`badge bg-soft-${kpi.color} text-${kpi.color} fs-11`}>{kpi.change}</span>}
                                        </div>
                                        <div className={`wd-40 ht-40 bg-soft-${kpi.color} text-${kpi.color} rounded-circle d-flex align-items-center justify-content-center`}>
                                            <kpi.icon size={20} />
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
                            <div className='card-header'>
                                <h5 className='card-title'>Recent Activity</h5>
                            </div>
                            <div className='card-body custom-card-action'>
                                <ul className='list-unstyled activity-feed'>
                                    {recentActivity.map((activity, index) => (
                                        <li key={index} className='feed-item d-flex align-items-start py-3 border-bottom'>
                                            <div className='flex-grow-1'>
                                                <p className='mb-1'>{activity.message}</p>
                                                <small className='text-muted'>{activity.time}</small>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}

export default HomePage
