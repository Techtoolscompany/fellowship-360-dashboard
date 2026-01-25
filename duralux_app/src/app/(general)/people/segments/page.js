'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import CardHeader from '@/components/shared/CardHeader'
import { FiPlus, FiUsers, FiTrendingUp, FiTrendingDown, FiActivity, FiHeart, FiBookOpen, FiMusic, FiStar, FiHome, FiGlobe, FiUserPlus } from 'react-icons/fi'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const ministrySegments = [
    { id: 1, name: 'Worship Team', count: 45, active: 42, icon: FiMusic, color: 'primary', growth: '+5', engagement: 94 },
    { id: 2, name: 'Youth Ministry', count: 89, active: 76, icon: FiStar, color: 'warning', growth: '+12', engagement: 85 },
    { id: 3, name: 'Small Groups', count: 234, active: 198, icon: FiHome, color: 'success', growth: '+18', engagement: 78 },
    { id: 4, name: 'Outreach', count: 67, active: 52, icon: FiGlobe, color: 'info', growth: '+8', engagement: 72 },
    { id: 5, name: 'Prayer Team', count: 38, active: 35, icon: FiHeart, color: 'danger', growth: '+3', engagement: 92 },
    { id: 6, name: 'Children\'s Ministry', count: 124, active: 98, icon: FiBookOpen, color: 'secondary', growth: '+15', engagement: 81 },
]

const membershipSegments = [
    { id: 1, name: 'Active Members', count: 847, trend: 'up', change: '+23', color: 'success' },
    { id: 2, name: 'New Believers', count: 34, trend: 'up', change: '+12', color: 'primary' },
    { id: 3, name: 'First-time Visitors', count: 45, trend: 'up', change: '+8', color: 'info' },
    { id: 4, name: 'Returning Visitors', count: 67, trend: 'up', change: '+5', color: 'warning' },
    { id: 5, name: 'At-Risk (30+ days)', count: 89, trend: 'down', change: '-12', color: 'danger' },
    { id: 6, name: 'Inactive (90+ days)', count: 156, trend: 'down', change: '-8', color: 'secondary' },
]

const segmentDistribution = {
    series: [847, 234, 124, 89, 67, 45, 38],
    options: {
        chart: { type: 'donut' },
        labels: ['Active Members', 'Small Groups', 'Children\'s Ministry', 'Youth Ministry', 'Outreach', 'Worship Team', 'Prayer Team'],
        colors: ['#10b981', '#8b5cf6', '#6b7280', '#f59e0b', '#06b6d4', '#3b82f6', '#ef4444'],
        legend: { position: 'bottom', fontSize: '12px' },
        plotOptions: { pie: { donut: { size: '55%' } } }
    }
}

const engagementTrendData = {
    series: [{
        name: 'Active',
        data: [780, 810, 825, 798, 847]
    }, {
        name: 'At-Risk',
        data: [120, 105, 98, 95, 89]
    }],
    options: {
        chart: { type: 'line', toolbar: { show: false } },
        colors: ['#10b981', '#ef4444'],
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan'] },
        yaxis: { min: 0 },
        grid: { borderColor: '#f1f1f1' },
        legend: { position: 'top' }
    }
}

const SegmentsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Ministry Segments</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/people/contacts">People</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Segments</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Create Segment</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    <div className='col-xxl-8'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Ministry Involvement" />
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead className='bg-light'>
                                            <tr>
                                                <th>Ministry</th>
                                                <th>Total</th>
                                                <th>Active</th>
                                                <th>Growth</th>
                                                <th>Engagement</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ministrySegments.map((segment) => (
                                                <tr key={segment.id}>
                                                    <td>
                                                        <div className='d-flex align-items-center gap-3'>
                                                            <div className={`wd-36 ht-36 bg-soft-${segment.color} text-${segment.color} rounded d-flex align-items-center justify-content-center`}>
                                                                <segment.icon size={16} />
                                                            </div>
                                                            <span className='fw-semibold'>{segment.name}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className='fw-bold'>{segment.count}</span></td>
                                                    <td>
                                                        <span className='text-success'>{segment.active}</span>
                                                        <span className='text-muted fs-11 ms-1'>({Math.round(segment.active / segment.count * 100)}%)</span>
                                                    </td>
                                                    <td><span className='badge bg-soft-success text-success'>{segment.growth}</span></td>
                                                    <td>
                                                        <div className='d-flex align-items-center gap-2'>
                                                            <div className='progress flex-grow-1 ht-6' style={{ width: '80px' }}>
                                                                <div className={`progress-bar bg-${segment.color}`} style={{ width: `${segment.engagement}%` }}></div>
                                                            </div>
                                                            <span className='fs-11 fw-semibold'>{segment.engagement}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-4'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Distribution" />
                            <div className='card-body d-flex align-items-center justify-content-center'>
                                <ReactApexChart
                                    options={segmentDistribution.options}
                                    series={segmentDistribution.series}
                                    type="donut"
                                    height={320}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className='row mb-4'>
                    <div className='col-xxl-6'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Membership Status" />
                            <div className='card-body'>
                                <div className='row g-3'>
                                    {membershipSegments.map((segment) => (
                                        <div key={segment.id} className='col-md-6'>
                                            <div className={`p-3 border border-dashed rounded-3 bg-soft-${segment.color}`}>
                                                <div className='d-flex justify-content-between align-items-start mb-2'>
                                                    <span className='fs-12 text-muted'>{segment.name}</span>
                                                    <span className={`badge bg-${segment.trend === 'up' ? 'success' : 'danger'}`}>
                                                        {segment.trend === 'up' ? <FiTrendingUp size={10} /> : <FiTrendingDown size={10} />}
                                                        {' '}{segment.change}
                                                    </span>
                                                </div>
                                                <h4 className={`fw-bold text-${segment.color} mb-0`}>{segment.count}</h4>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-6'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Engagement Trend" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={engagementTrendData.options}
                                    series={engagementTrendData.series}
                                    type="line"
                                    height={280}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}

export default SegmentsPage
