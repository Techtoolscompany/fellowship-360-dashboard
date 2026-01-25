import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiTag, FiUsers } from 'react-icons/fi'

const segments = [
    { id: 1, name: 'Members', count: 847, color: 'primary', description: 'Active church members' },
    { id: 2, name: 'Visitors', count: 156, color: 'info', description: 'First-time and returning visitors' },
    { id: 3, name: 'New Believers', count: 23, color: 'success', description: 'Recently accepted faith' },
    { id: 4, name: 'Volunteers', count: 124, color: 'warning', description: 'Active volunteers in ministries' },
    { id: 5, name: 'Youth', count: 89, color: 'secondary', description: 'Ages 13-18' },
    { id: 6, name: 'Small Group Leaders', count: 18, color: 'danger', description: 'Leading small groups' },
    { id: 7, name: 'Inactive', count: 234, color: 'dark', description: 'No attendance in 90+ days' },
    { id: 8, name: 'Donors', count: 412, color: 'success', description: 'Made donations in past year' },
]

const SegmentsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Segments</h2>
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
                <div className='row'>
                    {segments.map((segment) => (
                        <div key={segment.id} className='col-xl-3 col-lg-4 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between mb-3'>
                                        <div className={`wd-40 ht-40 bg-soft-${segment.color} text-${segment.color} rounded d-flex align-items-center justify-content-center`}>
                                            <FiTag size={20} />
                                        </div>
                                        <span className={`badge bg-soft-${segment.color} text-${segment.color}`}>
                                            <FiUsers size={12} className='me-1' /> {segment.count}
                                        </span>
                                    </div>
                                    <h6 className='fw-bold mb-1'>{segment.name}</h6>
                                    <p className='text-muted fs-12 mb-0'>{segment.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Footer />
        </>
    )
}

export default SegmentsPage
