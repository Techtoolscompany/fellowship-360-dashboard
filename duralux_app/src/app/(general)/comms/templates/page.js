import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiEdit, FiCopy, FiTrash2 } from 'react-icons/fi'

const templates = [
    { id: 1, name: 'Welcome New Visitor', type: 'email', lastModified: 'Jan 20, 2025', uses: 156 },
    { id: 2, name: 'Sunday Reminder', type: 'sms', lastModified: 'Jan 18, 2025', uses: 89 },
    { id: 3, name: 'Prayer Request Follow-up', type: 'email', lastModified: 'Jan 15, 2025', uses: 45 },
    { id: 4, name: 'Event Invitation', type: 'email', lastModified: 'Jan 12, 2025', uses: 234 },
    { id: 5, name: 'Thank You for Giving', type: 'email', lastModified: 'Jan 10, 2025', uses: 412 },
    { id: 6, name: 'Birthday Greeting', type: 'sms', lastModified: 'Jan 8, 2025', uses: 178 },
]

const TemplatesPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Templates</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/comms/conversations">Comms</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Templates</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Create Template</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    {templates.map((template) => (
                        <div key={template.id} className='col-lg-4 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex justify-content-between align-items-start mb-3'>
                                        <div>
                                            <h6 className='fw-bold mb-1'>{template.name}</h6>
                                            <span className={`badge bg-soft-${template.type === 'email' ? 'primary' : 'info'}`}>
                                                {template.type}
                                            </span>
                                        </div>
                                    </div>
                                    <p className='text-muted fs-12 mb-2'>Last modified: {template.lastModified}</p>
                                    <p className='text-muted fs-12 mb-3'>Used {template.uses} times</p>
                                    <div className='d-flex gap-2'>
                                        <button className='btn btn-sm btn-outline-primary'><FiEdit size={14} /></button>
                                        <button className='btn btn-sm btn-outline-secondary'><FiCopy size={14} /></button>
                                        <button className='btn btn-sm btn-outline-danger'><FiTrash2 size={14} /></button>
                                    </div>
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

export default TemplatesPage
