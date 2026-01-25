import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiSave } from 'react-icons/fi'

const GraceSettingsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Grace AI Settings</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/grace/calls">Grace AI</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Settings</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiSave size={14} className="me-1" /> Save Changes</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Agent Configuration</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Agent Name</label>
                                    <input type='text' className='form-control' defaultValue='Grace' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Voice Style</label>
                                    <select className='form-select'>
                                        <option value='friendly'>Friendly & Warm</option>
                                        <option value='professional'>Professional</option>
                                        <option value='casual'>Casual</option>
                                    </select>
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Church Name (for calls)</label>
                                    <input type='text' className='form-control' defaultValue='Fellowship Church' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Caller ID Number</label>
                                    <input type='text' className='form-control' defaultValue='(555) 123-4567' />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Call Settings</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Max Call Duration</label>
                                    <select className='form-select'>
                                        <option value='5'>5 minutes</option>
                                        <option value='10'>10 minutes</option>
                                        <option value='15'>15 minutes</option>
                                    </select>
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Calling Hours Start</label>
                                    <input type='time' className='form-control' defaultValue='09:00' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Calling Hours End</label>
                                    <input type='time' className='form-control' defaultValue='20:00' />
                                </div>
                                <div className='mb-3'>
                                    <div className='form-check form-switch'>
                                        <input className='form-check-input' type='checkbox' defaultChecked />
                                        <label className='form-check-label'>Leave voicemail if no answer</label>
                                    </div>
                                </div>
                                <div className='mb-3'>
                                    <div className='form-check form-switch'>
                                        <input className='form-check-input' type='checkbox' defaultChecked />
                                        <label className='form-check-label'>Auto-create follow-up tasks</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Call Scripts</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Welcome Call Script</label>
                                    <textarea className='form-control' rows='4' defaultValue="Hi [Name], this is Grace calling from [Church Name]. I wanted to personally thank you for visiting us and see if you have any questions about our church or upcoming events." />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Follow-up Call Script</label>
                                    <textarea className='form-control' rows='4' defaultValue="Hi [Name], this is Grace from [Church Name]. I'm just checking in to see how you're doing and if there's anything we can help you with." />
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

export default GraceSettingsPage
