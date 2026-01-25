'use client'
import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const events = [
    { id: 1, title: 'Sunday Service', date: 'Jan 26', time: '10:00 AM', location: 'Main Sanctuary' },
    { id: 2, title: 'Youth Group', date: 'Jan 26', time: '6:00 PM', location: 'Youth Room' },
    { id: 3, title: 'Small Group - Life Together', date: 'Jan 27', time: '7:00 PM', location: 'Room 201' },
    { id: 4, title: 'Prayer Meeting', date: 'Jan 28', time: '6:30 AM', location: 'Chapel' },
    { id: 5, title: 'Staff Meeting', date: 'Jan 28', time: '10:00 AM', location: 'Conference Room' },
    { id: 6, title: 'Worship Team Rehearsal', date: 'Jan 29', time: '7:00 PM', location: 'Main Sanctuary' },
]

const CalendarPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Calendar</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/scheduling/calendar">Scheduling</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Calendar</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Event</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header d-flex justify-content-between align-items-center'>
                                <button className='btn btn-sm btn-light'><FiChevronLeft /></button>
                                <h5 className='mb-0'>January 2025</h5>
                                <button className='btn btn-sm btn-light'><FiChevronRight /></button>
                            </div>
                            <div className='card-body'>
                                <div className='table-responsive'>
                                    <table className='table table-bordered text-center mb-0'>
                                        <thead>
                                            <tr>
                                                <th>Sun</th>
                                                <th>Mon</th>
                                                <th>Tue</th>
                                                <th>Wed</th>
                                                <th>Thu</th>
                                                <th>Fri</th>
                                                <th>Sat</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td>1</td>
                                                <td>2</td>
                                                <td>3</td>
                                                <td>4</td>
                                            </tr>
                                            <tr>
                                                <td className='bg-soft-primary'>5<br/><small className='text-primary'>Service</small></td>
                                                <td>6</td>
                                                <td>7</td>
                                                <td>8</td>
                                                <td>9</td>
                                                <td>10</td>
                                                <td>11</td>
                                            </tr>
                                            <tr>
                                                <td className='bg-soft-primary'>12<br/><small className='text-primary'>Service</small></td>
                                                <td>13</td>
                                                <td>14</td>
                                                <td>15</td>
                                                <td>16</td>
                                                <td>17</td>
                                                <td>18</td>
                                            </tr>
                                            <tr>
                                                <td className='bg-soft-primary'>19<br/><small className='text-primary'>Service</small></td>
                                                <td>20</td>
                                                <td>21</td>
                                                <td>22</td>
                                                <td>23</td>
                                                <td>24</td>
                                                <td className='bg-soft-info'>25<br/><small className='text-info'>Today</small></td>
                                            </tr>
                                            <tr>
                                                <td className='bg-soft-primary'>26<br/><small className='text-primary'>Service</small></td>
                                                <td className='bg-soft-success'>27<br/><small className='text-success'>Group</small></td>
                                                <td className='bg-soft-warning'>28<br/><small className='text-warning'>Prayer</small></td>
                                                <td>29</td>
                                                <td>30</td>
                                                <td>31</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Upcoming Events</h5>
                            </div>
                            <div className='card-body p-0'>
                                {events.map((event) => (
                                    <div key={event.id} className='p-3 border-bottom'>
                                        <h6 className='fs-13 fw-semibold mb-1'>{event.title}</h6>
                                        <p className='text-muted fs-12 mb-1'>{event.date} at {event.time}</p>
                                        <small className='text-muted'>{event.location}</small>
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

export default CalendarPage
