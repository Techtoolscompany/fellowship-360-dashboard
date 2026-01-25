import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiDownload, FiFilter, FiCalendar } from 'react-icons/fi'

const attendanceData = [
    { date: 'Jan 26, 2025', service: 'Sunday Service', attendance: 856, firstTime: 12, returning: 44 },
    { date: 'Jan 19, 2025', service: 'Sunday Service', attendance: 812, firstTime: 8, returning: 38 },
    { date: 'Jan 12, 2025', service: 'Sunday Service', attendance: 789, firstTime: 15, returning: 42 },
    { date: 'Jan 5, 2025', service: 'Sunday Service', attendance: 834, firstTime: 10, returning: 35 },
    { date: 'Dec 29, 2024', service: 'Sunday Service', attendance: 756, firstTime: 5, returning: 28 },
    { date: 'Dec 22, 2024', service: 'Christmas Service', attendance: 1245, firstTime: 45, returning: 89 },
]

const AttendancePage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Attendance Report</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/reports/overview">Reports</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Attendance</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-outline-secondary btn-sm"><FiDownload size={14} className="me-1" /> Export</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-primary mb-0'>856</h3>
                                <p className='text-muted fs-12 mb-0'>Last Sunday</p>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-success mb-0'>812</h3>
                                <p className='text-muted fs-12 mb-0'>4-Week Average</p>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-info mb-0'>+5.4%</h3>
                                <p className='text-muted fs-12 mb-0'>vs Last Month</p>
                            </div>
                        </div>
                    </div>
                    <div className='col-md-3'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body text-center'>
                                <h3 className='fw-bold text-warning mb-0'>45</h3>
                                <p className='text-muted fs-12 mb-0'>First-Time Visitors (MTD)</p>
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
                                                <th>Date</th>
                                                <th>Service</th>
                                                <th>Total Attendance</th>
                                                <th>First-Time Visitors</th>
                                                <th>Returning Visitors</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceData.map((row, index) => (
                                                <tr key={index}>
                                                    <td><FiCalendar size={14} className='me-1' />{row.date}</td>
                                                    <td>{row.service}</td>
                                                    <td className='fw-semibold'>{row.attendance}</td>
                                                    <td><span className='badge bg-soft-info'>{row.firstTime}</span></td>
                                                    <td><span className='badge bg-soft-success'>{row.returning}</span></td>
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

export default AttendancePage
