import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiSave } from 'react-icons/fi'

const ChurchProfilePage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Church Profile</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/settings/church-profile">Settings</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Church Profile</li>
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
                                <h5 className='card-title'>Basic Information</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Church Name</label>
                                    <input type='text' className='form-control' defaultValue='Fellowship Church' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Tagline</label>
                                    <input type='text' className='form-control' defaultValue='A place to belong' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Website</label>
                                    <input type='url' className='form-control' defaultValue='https://fellowshipchurch.com' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Phone</label>
                                    <input type='tel' className='form-control' defaultValue='(555) 123-4567' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Email</label>
                                    <input type='email' className='form-control' defaultValue='info@fellowshipchurch.com' />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-6'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Location</h5>
                            </div>
                            <div className='card-body'>
                                <div className='mb-3'>
                                    <label className='form-label'>Street Address</label>
                                    <input type='text' className='form-control' defaultValue='123 Church Street' />
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>City</label>
                                    <input type='text' className='form-control' defaultValue='Springfield' />
                                </div>
                                <div className='row mb-3'>
                                    <div className='col-md-6'>
                                        <label className='form-label'>State</label>
                                        <input type='text' className='form-control' defaultValue='IL' />
                                    </div>
                                    <div className='col-md-6'>
                                        <label className='form-label'>ZIP Code</label>
                                        <input type='text' className='form-control' defaultValue='62701' />
                                    </div>
                                </div>
                                <div className='mb-3'>
                                    <label className='form-label'>Timezone</label>
                                    <select className='form-select'>
                                        <option value='America/Chicago'>Central Time (CT)</option>
                                        <option value='America/New_York'>Eastern Time (ET)</option>
                                        <option value='America/Denver'>Mountain Time (MT)</option>
                                        <option value='America/Los_Angeles'>Pacific Time (PT)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Service Times</h5>
                            </div>
                            <div className='card-body'>
                                <div className='row'>
                                    <div className='col-md-4 mb-3'>
                                        <label className='form-label'>Sunday Service 1</label>
                                        <input type='text' className='form-control' defaultValue='9:00 AM' />
                                    </div>
                                    <div className='col-md-4 mb-3'>
                                        <label className='form-label'>Sunday Service 2</label>
                                        <input type='text' className='form-control' defaultValue='11:00 AM' />
                                    </div>
                                    <div className='col-md-4 mb-3'>
                                        <label className='form-label'>Wednesday Service</label>
                                        <input type='text' className='form-control' defaultValue='7:00 PM' />
                                    </div>
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

export default ChurchProfilePage
