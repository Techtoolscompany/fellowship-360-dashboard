'use client'
import React, { useState } from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiMail, FiPhone, FiMessageSquare, FiEdit, FiCalendar, FiUser, FiX, FiCheck, FiMapPin, FiUsers } from 'react-icons/fi'
import { useParams } from 'next/navigation'
import { useToast } from '@/components/shared/Toast'

const initialContactDetails = {
    name: 'Sarah Johnson',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.j@email.com',
    phone: '(555) 123-4567',
    status: 'Member',
    memberSince: 'January 2022',
    address: '123 Main Street',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    birthday: 'March 15',
    notes: 'Active in worship team. Interested in volunteering for youth ministry.',
    family: ['John Johnson (Spouse)', 'Emma Johnson (Child)'],
    groups: ['Worship Team', 'Small Group - Life Together'],
}

const timeline = [
    { type: 'call', message: 'Grace AI follow-up call completed', date: '2 days ago', details: 'Discussed upcoming events' },
    { type: 'message', message: 'Text message sent', date: '1 week ago', details: 'Weekly newsletter' },
    { type: 'visit', message: 'Attended Sunday Service', date: '1 week ago', details: 'Main Campus' },
    { type: 'note', message: 'Note added by Pastor Mike', date: '2 weeks ago', details: 'Interested in volunteering for youth ministry' },
    { type: 'email', message: 'Email received', date: '3 weeks ago', details: 'Prayer request submitted' },
]

const ContactDetailPage = () => {
    const params = useParams()
    const toast = useToast()
    const [contactDetails, setContactDetails] = useState(initialContactDetails)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState(initialContactDetails)
    
    const handleEditClick = () => {
        setEditForm(contactDetails)
        setIsEditing(true)
    }
    
    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditForm(contactDetails)
    }
    
    const handleSaveEdit = () => {
        setContactDetails({
            ...editForm,
            name: `${editForm.firstName} ${editForm.lastName}`
        })
        setIsEditing(false)
        toast.success('Contact updated successfully')
    }
    
    const handleInputChange = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }))
    }
    
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Contact Profile</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/people/contacts">Contacts</a></li>
                                <li className="breadcrumb-item active" aria-current="page">{contactDetails.name}</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-primary btn-sm"><FiPhone size={14} className="me-1" /> Call</button>
                        <button className="btn btn-outline-primary btn-sm"><FiMessageSquare size={14} className="me-1" /> Message</button>
                        <button className="btn btn-primary btn-sm" onClick={handleEditClick}><FiEdit size={14} className="me-1" /> Edit</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Profile</h5>
                            </div>
                            <div className='card-body text-center'>
                                <div className='avatar avatar-xl bg-primary text-white rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center' style={{width: '80px', height: '80px'}}>
                                    <span className='fs-3'>{contactDetails.name.split(' ').map(n => n[0]).join('')}</span>
                                </div>
                                <h5 className='mb-1'>{contactDetails.name}</h5>
                                <span className='badge bg-soft-success text-success mb-3'>{contactDetails.status}</span>
                                <div className='text-start mt-4'>
                                    <p className='mb-2'><FiMail className='me-2' /> {contactDetails.email}</p>
                                    <p className='mb-2'><FiPhone className='me-2' /> {contactDetails.phone}</p>
                                    <p className='mb-2'><FiCalendar className='me-2' /> Member since {contactDetails.memberSince}</p>
                                    <p className='mb-0'><FiUser className='me-2' /> Birthday: {contactDetails.birthday}</p>
                                </div>
                            </div>
                        </div>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Details</h5>
                            </div>
                            <div className='card-body'>
                                <h6 className='fs-13 fw-semibold mb-2'><FiMapPin className='me-1' /> Address</h6>
                                <p className='text-muted fs-12 mb-3'>{contactDetails.address}, {contactDetails.city}, {contactDetails.state} {contactDetails.zip}</p>
                                <h6 className='fs-13 fw-semibold mb-2'><FiUsers className='me-1' /> Family</h6>
                                <ul className='list-unstyled mb-3'>
                                    {contactDetails.family.map((member, i) => (
                                        <li key={i} className='text-muted fs-12'>{member}</li>
                                    ))}
                                </ul>
                                <h6 className='fs-13 fw-semibold mb-2'>Groups</h6>
                                <div className='d-flex flex-wrap gap-1'>
                                    {contactDetails.groups.map((group, i) => (
                                        <span key={i} className='badge bg-soft-primary text-primary'>{group}</span>
                                    ))}
                                </div>
                                {contactDetails.notes && (
                                    <>
                                        <h6 className='fs-13 fw-semibold mb-2 mt-3'>Notes</h6>
                                        <p className='text-muted fs-12 mb-0'>{contactDetails.notes}</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Recent Activity</h5>
                            </div>
                            <div className='card-body'>
                                <ul className='list-unstyled'>
                                    {timeline.map((item, index) => (
                                        <li key={index} className='d-flex align-items-start py-3 border-bottom'>
                                            <div className='flex-grow-1'>
                                                <h6 className='fs-13 fw-semibold mb-1'>{item.message}</h6>
                                                <p className='text-muted fs-12 mb-1'>{item.details}</p>
                                                <small className='text-muted'>{item.date}</small>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {isEditing && (
                <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Edit Contact</h5>
                                <button type="button" className="btn-close" onClick={handleCancelEdit}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label">First Name</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.firstName}
                                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Last Name</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.lastName}
                                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Email</label>
                                        <input 
                                            type="email" 
                                            className="form-control" 
                                            value={editForm.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Phone</label>
                                        <input 
                                            type="tel" 
                                            className="form-control" 
                                            value={editForm.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Birthday</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.birthday}
                                            onChange={(e) => handleInputChange('birthday', e.target.value)}
                                            placeholder="e.g., March 15"
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Status</label>
                                        <select 
                                            className="form-select"
                                            value={editForm.status}
                                            onChange={(e) => handleInputChange('status', e.target.value)}
                                        >
                                            <option value="Visitor">Visitor</option>
                                            <option value="Regular Attendee">Regular Attendee</option>
                                            <option value="Member">Member</option>
                                            <option value="Leader">Leader</option>
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Street Address</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.address}
                                            onChange={(e) => handleInputChange('address', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-5">
                                        <label className="form-label">City</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.city}
                                            onChange={(e) => handleInputChange('city', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label">State</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.state}
                                            onChange={(e) => handleInputChange('state', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">ZIP</label>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            value={editForm.zip}
                                            onChange={(e) => handleInputChange('zip', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Notes</label>
                                        <textarea 
                                            className="form-control" 
                                            rows="3"
                                            value={editForm.notes}
                                            onChange={(e) => handleInputChange('notes', e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                                    <FiX className="me-1" /> Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>
                                    <FiCheck className="me-1" /> Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <Footer />
        </>
    )
}

export default ContactDetailPage
