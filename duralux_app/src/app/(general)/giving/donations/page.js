'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import PageHeaderDate from '@/components/shared/pageHeader/PageHeaderDate'
import Footer from '@/components/shared/Footer'
import CardHeader from '@/components/shared/CardHeader'
import CsvExportButton from '@/components/shared/CsvExport'
import { useToast } from '@/components/shared/Toast'
import { FiFilter, FiDollarSign, FiTrendingUp, FiUsers, FiPieChart } from 'react-icons/fi'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const weeklyGivingData = {
    series: [{
        name: 'Giving',
        data: [8200, 11500, 9800, 12450, 10200, 14500, 12450]
    }],
    options: {
        chart: { type: 'area', toolbar: { show: false }, sparkline: { enabled: false } },
        colors: ['#10b981'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
        yaxis: { labels: { formatter: (val) => '$' + val.toLocaleString() } },
        tooltip: { y: { formatter: (val) => '$' + val.toLocaleString() } },
        grid: { borderColor: '#f1f1f1' }
    }
}

const fundBreakdownData = {
    series: [45, 25, 15, 10, 5],
    options: {
        chart: { type: 'donut' },
        labels: ['General Fund', 'Building Fund', 'Missions', 'Youth Ministry', 'Benevolence'],
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
        legend: { position: 'bottom' },
        plotOptions: { pie: { donut: { size: '65%' } } },
        dataLabels: { enabled: true, formatter: (val) => val.toFixed(0) + '%' }
    }
}

const monthlyTrendData = {
    series: [{
        name: 'Monthly Giving',
        data: [42000, 38500, 45200, 41000, 48200]
    }],
    options: {
        chart: { type: 'bar', toolbar: { show: false } },
        colors: ['#3b82f6'],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
        xaxis: { categories: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan'] },
        yaxis: { labels: { formatter: (val) => '$' + (val / 1000) + 'k' } },
        tooltip: { y: { formatter: (val) => '$' + val.toLocaleString() } },
        grid: { borderColor: '#f1f1f1' }
    }
}

const donations = [
    { id: 1, date: 'Jan 25, 2025', donor: 'Robert Brown', amount: '$250.00', fund: 'General', method: 'Online', status: 'Completed' },
    { id: 2, date: 'Jan 25, 2025', donor: 'Sarah Johnson', amount: '$100.00', fund: 'Building Fund', method: 'Online', status: 'Completed' },
    { id: 3, date: 'Jan 24, 2025', donor: 'Michael Davis', amount: '$75.00', fund: 'General', method: 'Check', status: 'Completed' },
    { id: 4, date: 'Jan 24, 2025', donor: 'Anonymous', amount: '$500.00', fund: 'Missions', method: 'Cash', status: 'Completed' },
    { id: 5, date: 'Jan 23, 2025', donor: 'Emily White', amount: '$150.00', fund: 'General', method: 'Online', status: 'Completed' },
]

const kpiStats = [
    { title: 'This Week', amount: '$12,450', change: '+15%', icon: FiDollarSign, color: 'success', subtext: 'vs last week' },
    { title: 'Active Donors', amount: '412', change: '+8', icon: FiUsers, color: 'primary', subtext: 'new this month' },
    { title: 'Avg. Gift', amount: '$85', change: '+12%', icon: FiTrendingUp, color: 'info', subtext: 'vs last month' },
    { title: 'Recurring', amount: '67%', change: '+3%', icon: FiPieChart, color: 'warning', subtext: 'of total giving' },
]

const DonationsPage = () => {
    const toast = useToast()

    const handleExport = () => {
        toast.success('Donations exported successfully!')
    }

    return (
        <>
            <PageHeader>
                <PageHeaderDate />
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    {kpiStats.map((stat, index) => (
                        <div key={index} className='col-xl-3 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between'>
                                        <div>
                                            <p className='text-muted fs-12 mb-1'>{stat.title}</p>
                                            <h3 className='fw-bold mb-1'>{stat.amount}</h3>
                                            <span className='badge bg-soft-success text-success me-1'>{stat.change}</span>
                                            <span className='text-muted fs-11'>{stat.subtext}</span>
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
                            <CardHeader title="Weekly Giving Trend" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={weeklyGivingData.options}
                                    series={weeklyGivingData.series}
                                    type="area"
                                    height={300}
                                />
                            </div>
                            <div className='card-footer'>
                                <div className='row g-3'>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Total This Week</div>
                                            <h5 className='fw-bold text-success mb-0'>$79,300</h5>
                                        </div>
                                    </div>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Sunday Peak</div>
                                            <h5 className='fw-bold text-primary mb-0'>$14,500</h5>
                                        </div>
                                    </div>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Online Giving</div>
                                            <h5 className='fw-bold text-info mb-0'>72%</h5>
                                        </div>
                                    </div>
                                    <div className='col-md-3'>
                                        <div className='p-3 border border-dashed rounded text-center'>
                                            <div className='fs-11 text-muted mb-1'>Goal Progress</div>
                                            <h5 className='fw-bold text-warning mb-0'>85%</h5>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-4'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Fund Breakdown" />
                            <div className='card-body d-flex align-items-center justify-content-center'>
                                <ReactApexChart
                                    options={fundBreakdownData.options}
                                    series={fundBreakdownData.series}
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
                            <CardHeader title="Monthly Trend" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={monthlyTrendData.options}
                                    series={monthlyTrendData.series}
                                    type="bar"
                                    height={250}
                                />
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header d-flex justify-content-between align-items-center'>
                                <h5 className='card-title mb-0'>Recent Donations</h5>
                                <div className='d-flex gap-2'>
                                    <button className='btn btn-sm btn-outline-secondary'><FiFilter size={14} /> Filter</button>
                                    <CsvExportButton 
                                        data={donations} 
                                        filename="donations" 
                                        onExport={handleExport}
                                    />
                                </div>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Donor</th>
                                                <th>Amount</th>
                                                <th>Fund</th>
                                                <th>Method</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {donations.map((donation) => (
                                                <tr key={donation.id}>
                                                    <td>{donation.date}</td>
                                                    <td className='fw-semibold'>{donation.donor}</td>
                                                    <td className='text-success fw-semibold'>{donation.amount}</td>
                                                    <td><span className='badge bg-soft-primary'>{donation.fund}</span></td>
                                                    <td>{donation.method}</td>
                                                    <td><span className={`badge bg-soft-${donation.status === 'Completed' ? 'success' : 'warning'}`}>{donation.status}</span></td>
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

export default DonationsPage
