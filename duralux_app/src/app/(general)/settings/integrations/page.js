import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiCheck, FiX } from 'react-icons/fi'

const integrations = [
    { name: 'Planning Center', description: 'Sync people and events', status: 'Connected', category: 'Church Management' },
    { name: 'Stripe', description: 'Process online donations', status: 'Connected', category: 'Payments' },
    { name: 'Twilio', description: 'SMS messaging', status: 'Connected', category: 'Communications' },
    { name: 'SendGrid', description: 'Email delivery', status: 'Connected', category: 'Communications' },
    { name: 'Google Calendar', description: 'Calendar sync', status: 'Not Connected', category: 'Productivity' },
    { name: 'Mailchimp', description: 'Email marketing', status: 'Not Connected', category: 'Marketing' },
    { name: 'Zoom', description: 'Virtual meetings', status: 'Not Connected', category: 'Productivity' },
    { name: 'Facebook', description: 'Social media', status: 'Not Connected', category: 'Social' },
]

const IntegrationsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Integrations</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/settings/church-profile">Settings</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Integrations</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    {integrations.map((integration, index) => (
                        <div key={index} className='col-lg-3 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex justify-content-between align-items-start mb-3'>
                                        <div className='wd-40 ht-40 bg-light rounded d-flex align-items-center justify-content-center'>
                                            <span className='fw-bold'>{integration.name.charAt(0)}</span>
                                        </div>
                                        {integration.status === 'Connected' ? (
                                            <span className='badge bg-soft-success text-success'><FiCheck size={12} /> Connected</span>
                                        ) : (
                                            <span className='badge bg-soft-secondary text-secondary'><FiX size={12} /> Not Connected</span>
                                        )}
                                    </div>
                                    <h6 className='fw-bold mb-1'>{integration.name}</h6>
                                    <p className='text-muted fs-12 mb-2'>{integration.description}</p>
                                    <small className='text-muted'>{integration.category}</small>
                                    <div className='mt-3'>
                                        {integration.status === 'Connected' ? (
                                            <button className='btn btn-sm btn-outline-danger w-100'>Disconnect</button>
                                        ) : (
                                            <button className='btn btn-sm btn-primary w-100'>Connect</button>
                                        )}
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

export default IntegrationsPage
