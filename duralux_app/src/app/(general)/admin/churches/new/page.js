import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiSave } from 'react-icons/fi'

const NewChurchPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Add New Church</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/admin/churches">Churches</a></li>
                                <li className="breadcrumb-item active" aria-current="page">New</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiSave size={14} className="me-1" /> Create Church</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Church Information</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Church Name *</label>
                                    <input type='text' className='form-control' placeholder='Enter church name' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Website</label>
                                    <input type='url' className='form-control' placeholder='https://' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Phone</label>
                                    <input type='tel' className='form-control' placeholder='(555) 123-4567' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Street Address</label>
                                    <input type='text' className='form-control' placeholder='123 Church Street' />
                                </div>
                                <div className='row mb-3'>
                                    <div className='col-md-6'>
                                        <label className='form-label'>City</label>
                                        <input type='text' className='form-control' placeholder='City' />
                                    </div>
                                    <div className='col-md-3'>
                                        <label className='form-label'>State</label>
                                        <input type='text' className='form-control' placeholder='IL' />
                                    </div>
                                    <div className='col-md-3'>
                                        <label className='form-label'>ZIP</label>
                                        <input type='text' className='form-control' placeholder='62701' />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Admin User</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Admin Name *</label>
                                    <input type='text' className='form-control' placeholder='Full name' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Admin Email *</label>
                                    <input type='email' className='form-control' placeholder='email@church.com' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Admin Phone</label>
                                    <input type='tel' className='form-control' placeholder='(555) 123-4567' />
                                </div>
                            </div>
                        </div>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Subscription</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Plan</label>
                                    <select className='form-select'>
                                        <option value='trial'>Trial (14 days free)</option>
                                        <option value='starter'>Starter - $49/mo</option>
                                        <option value='pro'>Pro - $99/mo</option>
                                        <option value='enterprise'>Enterprise - Custom</option>
                                    </select>
                                </div>
                                <div className='form-check form-switch mb-3'>
                                    <input className='form-check-input' type='checkbox' defaultChecked />
                                    <label className='form-check-label'>Send welcome email</label>
                                </div>
                                <div className='form-check form-switch'>
                                    <input className='form-check-input' type='checkbox' defaultChecked />
                                    <label className='form-check-label'>Enable Grace AI</label>
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

export default NewChurchPage
