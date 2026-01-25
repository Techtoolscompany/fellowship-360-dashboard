import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import Link from 'next/link'
import { FiPlus, FiDownload, FiFilter } from 'react-icons/fi'

const contactsData = [
    { id: 1, name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567', status: 'Member', lastContact: '2 days ago' },
    { id: 2, name: 'Michael Davis', email: 'michael.d@email.com', phone: '(555) 234-5678', status: 'Visitor', lastContact: '1 week ago' },
    { id: 3, name: 'Emily White', email: 'emily.w@email.com', phone: '(555) 345-6789', status: 'Member', lastContact: '3 days ago' },
    { id: 4, name: 'Robert Brown', email: 'robert.b@email.com', phone: '(555) 456-7890', status: 'Regular Attender', lastContact: '1 day ago' },
    { id: 5, name: 'Jennifer Martinez', email: 'jennifer.m@email.com', phone: '(555) 567-8901', status: 'New Visitor', lastContact: 'Today' },
    { id: 6, name: 'David Wilson', email: 'david.w@email.com', phone: '(555) 678-9012', status: 'Member', lastContact: '5 days ago' },
    { id: 7, name: 'Amanda Taylor', email: 'amanda.t@email.com', phone: '(555) 789-0123', status: 'Inactive', lastContact: '1 month ago' },
    { id: 8, name: 'Christopher Lee', email: 'chris.l@email.com', phone: '(555) 890-1234', status: 'Member', lastContact: '2 weeks ago' },
]

const ContactsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Contacts</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/people/contacts">People</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Contacts</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-outline-secondary btn-sm"><FiDownload size={14} className="me-1" /> Export</button>
                        <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Contact</button>
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
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Phone</th>
                                                <th>Status</th>
                                                <th>Last Contact</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {contactsData.map((contact) => (
                                                <tr key={contact.id}>
                                                    <td>
                                                        <Link href={`/people/contacts/${contact.id}`} className="text-primary fw-semibold">
                                                            {contact.name}
                                                        </Link>
                                                    </td>
                                                    <td>{contact.email}</td>
                                                    <td>{contact.phone}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${contact.status === 'Member' ? 'success' : contact.status === 'Visitor' || contact.status === 'New Visitor' ? 'info' : contact.status === 'Inactive' ? 'danger' : 'primary'}`}>
                                                            {contact.status}
                                                        </span>
                                                    </td>
                                                    <td>{contact.lastContact}</td>
                                                    <td>
                                                        <Link href={`/people/contacts/${contact.id}`} className="btn btn-sm btn-light">View</Link>
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

export default ContactsPage
