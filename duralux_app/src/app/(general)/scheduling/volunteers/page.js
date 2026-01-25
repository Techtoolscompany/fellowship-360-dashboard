import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiFilter, FiCheck, FiX } from 'react-icons/fi'

const volunteerSchedule = [
    { id: 1, event: 'Sunday Service - Jan 26', role: 'Greeter', volunteer: 'Sarah Johnson', status: 'Confirmed' },
    { id: 2, event: 'Sunday Service - Jan 26', role: 'Audio Tech', volunteer: 'Michael Davis', status: 'Confirmed' },
    { id: 3, event: 'Sunday Service - Jan 26', role: 'Nursery', volunteer: 'Emily White', status: 'Pending' },
    { id: 4, event: 'Sunday Service - Jan 26', role: 'Usher', volunteer: 'Robert Brown', status: 'Confirmed' },
    { id: 5, event: 'Youth Group - Jan 26', role: 'Leader', volunteer: 'Jennifer Martinez', status: 'Confirmed' },
    { id: 6, event: 'Youth Group - Jan 26', role: 'Snacks', volunteer: 'David Wilson', status: 'Declined' },
]

const ministryTeams = [
    { name: 'Worship Team', members: 12, nextServing: 'Jan 26' },
    { name: 'Greeters', members: 8, nextServing: 'Jan 26' },
    { name: 'Tech Team', members: 6, nextServing: 'Jan 26' },
    { name: 'Nursery', members: 10, nextServing: 'Jan 26' },
    { name: 'Youth Leaders', members: 5, nextServing: 'Jan 26' },
    { name: 'Ushers', members: 8, nextServing: 'Jan 26' },
]

const VolunteersPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Volunteers</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/scheduling/calendar">Scheduling</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Volunteers</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Schedule Volunteer</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Upcoming Schedule</h5>
                            </div>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Event</th>
                                                <th>Role</th>
                                                <th>Volunteer</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {volunteerSchedule.map((item) => (
                                                <tr key={item.id}>
                                                    <td>{item.event}</td>
                                                    <td>{item.role}</td>
                                                    <td>{item.volunteer}</td>
                                                    <td>
                                                        {item.status === 'Confirmed' && <span className='badge bg-soft-success text-success'><FiCheck size={12} /> Confirmed</span>}
                                                        {item.status === 'Pending' && <span className='badge bg-soft-warning text-warning'>Pending</span>}
                                                        {item.status === 'Declined' && <span className='badge bg-soft-danger text-danger'><FiX size={12} /> Declined</span>}
                                                    </td>
                                                    <td>
                                                        <button className='btn btn-sm btn-light'>Reassign</button>
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
                            <div className='card-header'>
                                <h5 className='card-title'>Ministry Teams</h5>
                            </div>
                            <div className='card-body p-0'>
                                {ministryTeams.map((team, index) => (
                                    <div key={index} className='d-flex justify-content-between align-items-center p-3 border-bottom'>
                                        <div>
                                            <h6 className='fs-13 fw-semibold mb-1'>{team.name}</h6>
                                            <small className='text-muted'>{team.members} members</small>
                                        </div>
                                        <span className='badge bg-soft-primary'>Next: {team.nextServing}</span>
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

export default VolunteersPage
