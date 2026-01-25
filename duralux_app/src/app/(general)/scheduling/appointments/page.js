import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiFilter, FiCalendar } from 'react-icons/fi'

const appointments = [
    { id: 1, title: 'Pastoral Counseling', with: 'Sarah Johnson', staff: 'Pastor Mike', date: 'Jan 26, 2025', time: '2:00 PM', status: 'Confirmed' },
    { id: 2, title: 'New Member Meeting', with: 'Michael Davis', staff: 'Pastor Mike', date: 'Jan 27, 2025', time: '10:00 AM', status: 'Confirmed' },
    { id: 3, title: 'Premarital Counseling', with: 'Robert & Emily', staff: 'Pastor Sarah', date: 'Jan 28, 2025', time: '4:00 PM', status: 'Pending' },
    { id: 4, title: 'Volunteer Interview', with: 'Jennifer Martinez', staff: 'John D.', date: 'Jan 29, 2025', time: '11:00 AM', status: 'Confirmed' },
    { id: 5, title: 'Baptism Consultation', with: 'David Wilson', staff: 'Pastor Mike', date: 'Jan 30, 2025', time: '3:00 PM', status: 'Confirmed' },
]

const AppointmentsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Appointments</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/scheduling/calendar">Scheduling</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Appointments</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> New Appointment</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Appointment</th>
                                                <th>With</th>
                                                <th>Staff</th>
                                                <th>Date</th>
                                                <th>Time</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {appointments.map((apt) => (
                                                <tr key={apt.id}>
                                                    <td className='fw-semibold'>{apt.title}</td>
                                                    <td>{apt.with}</td>
                                                    <td>{apt.staff}</td>
                                                    <td><FiCalendar size={14} className='me-1' />{apt.date}</td>
                                                    <td>{apt.time}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${apt.status === 'Confirmed' ? 'success' : 'warning'}`}>
                                                            {apt.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button className='btn btn-sm btn-light me-1'>Edit</button>
                                                        <button className='btn btn-sm btn-outline-danger'>Cancel</button>
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

export default AppointmentsPage
