'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import PageHeaderDate from '@/components/shared/pageHeader/PageHeaderDate'
import Footer from '@/components/shared/Footer'
import CardHeader from '@/components/shared/CardHeader'
import { FiUsers, FiDollarSign, FiCalendar, FiPhone, FiTrendingUp, FiHeart, FiTarget, FiActivity } from 'react-icons/fi'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const attendanceChartData = {
    series: [{
        name: 'Attendance',
        data: [720, 785, 856, 790, 820, 875, 856]
    }],
    options: {
        chart: { type: 'area', toolbar: { show: false } },
        colors: ['#3b82f6'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'] },
        yaxis: { min: 600, max: 1000 },
        grid: { borderColor: '#f1f1f1' },
        tooltip: { y: { formatter: (val) => val + ' attendees' } }
    }
}

const givingChartData = {
    series: [{
        name: 'Giving',
        data: [42000, 38500, 45200, 41000, 48200, 44500, 48200]
    }],
    options: {
        chart: { type: 'bar', toolbar: { show: false } },
        colors: ['#10b981'],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'] },
        yaxis: { labels: { formatter: (val) => '$' + (val / 1000) + 'k' } },
        tooltip: { y: { formatter: (val) => '$' + val.toLocaleString() } },
        grid: { borderColor: '#f1f1f1' }
    }
}

const engagementRadarData = {
    series: [{
        name: 'This Month',
        data: [85, 72, 68, 91, 78, 65]
    }, {
        name: 'Last Month',
        data: [75, 68, 62, 85, 72, 58]
    }],
    options: {
        chart: { type: 'radar', toolbar: { show: false } },
        colors: ['#3b82f6', '#94a3b8'],
        xaxis: { categories: ['Attendance', 'Giving', 'Volunteering', 'Small Groups', 'Events', 'Online'] },
        yaxis: { show: false },
        markers: { size: 4 },
        stroke: { width: 2 }
    }
}

const visitorConversionData = {
    series: [32, 45, 12, 8, 3],
    options: {
        chart: { type: 'donut' },
        labels: ['Joined', 'In Pipeline', 'Connected', 'Attempted', 'Inactive'],
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'],
        legend: { position: 'bottom' },
        plotOptions: { pie: { donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Conversion', formatter: () => '32%' } } } } }
    }
}

const stats = [
    { title: 'Weekly Attendance', value: '856', change: '+8%', icon: FiCalendar, color: 'primary', detail: 'Avg this month' },
    { title: 'Monthly Giving', value: '$48,200', change: '+15%', icon: FiDollarSign, color: 'success', detail: 'vs last month' },
    { title: 'Grace AI Calls', value: '312', change: '+23%', icon: FiPhone, color: 'warning', detail: 'This month' },
    { title: 'Engagement Score', value: '78%', change: '+5%', icon: FiActivity, color: 'info', detail: 'Overall health' },
]

const growthMetrics = [
    { label: 'New Members', current: 23, previous: 18, color: 'success' },
    { label: 'First-time Visitors', current: 45, previous: 38, color: 'info' },
    { label: 'Small Group Signups', current: 12, previous: 8, color: 'warning' },
    { label: 'Volunteer Applications', current: 8, previous: 6, color: 'primary' },
]

const ReportsOverviewPage = () => {
    return (
        <>
            <PageHeader>
                <PageHeaderDate />
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    {stats.map((stat, index) => (
                        <div key={index} className='col-xl-3 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between'>
                                        <div>
                                            <p className='text-muted fs-12 mb-1'>{stat.title}</p>
                                            <h3 className='fw-bold mb-1'>{stat.value}</h3>
                                            <span className='badge bg-soft-success text-success me-1'>{stat.change}</span>
                                            <span className='text-muted fs-11'>{stat.detail}</span>
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

                <div className='row mb-4'>
                    <div className='col-xxl-8'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Weekly Attendance Trend" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={attendanceChartData.options}
                                    series={attendanceChartData.series}
                                    type="area"
                                    height={300}
                                />
                            </div>
                            <div className='card-footer'>
                                <div className='row g-3'>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Peak Sunday</div>
                                            <h5 className='fw-bold text-primary mb-0'>875</h5>
                                        </div>
                                    </div>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Average</div>
                                            <h5 className='fw-bold text-info mb-0'>815</h5>
                                        </div>
                                    </div>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Growth Rate</div>
                                            <h5 className='fw-bold text-success mb-0'>+8%</h5>
                                        </div>
                                    </div>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Capacity</div>
                                            <h5 className='fw-bold text-warning mb-0'>71%</h5>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-4'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Visitor Conversion" />
                            <div className='card-body d-flex align-items-center justify-content-center'>
                                <ReactApexChart
                                    options={visitorConversionData.options}
                                    series={visitorConversionData.series}
                                    type="donut"
                                    height={320}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className='row mb-4'>
                    <div className='col-xxl-4'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Monthly Giving" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={givingChartData.options}
                                    series={givingChartData.series}
                                    type="bar"
                                    height={280}
                                />
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-4'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Engagement Radar" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={engagementRadarData.options}
                                    series={engagementRadarData.series}
                                    type="radar"
                                    height={280}
                                />
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-4'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Growth Metrics" />
                            <div className='card-body'>
                                {growthMetrics.map((metric, index) => (
                                    <div key={index} className='mb-4'>
                                        <div className='d-flex justify-content-between mb-2'>
                                            <span className='fw-semibold'>{metric.label}</span>
                                            <div>
                                                <span className={`text-${metric.color} fw-bold`}>{metric.current}</span>
                                                <span className='text-muted fs-11 ms-2'>vs {metric.previous}</span>
                                            </div>
                                        </div>
                                        <div className='progress ht-6'>
                                            <div className={`progress-bar bg-${metric.color}`} style={{ width: `${(metric.current / 50) * 100}%` }}></div>
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

export default ReportsOverviewPage
