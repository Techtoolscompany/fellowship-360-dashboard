'use client'
import React, { useState } from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import ContactCard from '@/components/shared/ContactCard'
import Link from 'next/link'
import { FiPlus, FiDownload, FiFilter, FiGrid, FiList, FiSearch } from 'react-icons/fi'

const contactsData = [
    { id: 1, name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567', status: 'Member', lastContact: '2 days ago', groups: ['Worship Team', 'Small Group'] },
    { id: 2, name: 'Michael Davis', email: 'michael.d@email.com', phone: '(555) 234-5678', status: 'Visitor', lastContact: '1 week ago', groups: [] },
    { id: 3, name: 'Emily White', email: 'emily.w@email.com', phone: '(555) 345-6789', status: 'Member', lastContact: '3 days ago', groups: ['Youth Ministry'] },
    { id: 4, name: 'Robert Brown', email: 'robert.b@email.com', phone: '(555) 456-7890', status: 'Regular Attendee', lastContact: '1 day ago', groups: ['Mens Group'] },
    { id: 5, name: 'Jennifer Martinez', email: 'jennifer.m@email.com', phone: '(555) 567-8901', status: 'Visitor', lastContact: 'Today', groups: [] },
    { id: 6, name: 'David Wilson', email: 'david.w@email.com', phone: '(555) 678-9012', status: 'Member', lastContact: '5 days ago', groups: ['Deacons', 'Finance Team'] },
    { id: 7, name: 'Amanda Taylor', email: 'amanda.t@email.com', phone: '(555) 789-0123', status: 'Member', lastContact: '1 month ago', groups: ['Worship Team'] },
    { id: 8, name: 'Christopher Lee', email: 'chris.l@email.com', phone: '(555) 890-1234', status: 'Member', lastContact: '2 weeks ago', groups: ['Tech Team', 'Small Group'] },
]

const ContactsPage = () => {
    const [viewMode, setViewMode] = useState('grid')
    const [searchQuery, setSearchQuery] = useState('')
    
    const filteredContacts = contactsData.filter(contact => 
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'member':
                return 'bg-soft-success text-success'
            case 'visitor':
                return 'bg-soft-info text-info'
            case 'regular attendee':
                return 'bg-soft-primary text-primary'
            case 'leader':
                return 'bg-soft-warning text-warning'
            default:
                return 'bg-soft-secondary text-secondary'
        }
    }
    
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
                <div className='row mb-4'>
                    <div className='col-12'>
                        <div className='d-flex align-items-center justify-content-between gap-3'>
                            <div className='position-relative' style={{ maxWidth: '360px', flex: 1 }}>
                                <FiSearch 
                                    size={18} 
                                    style={{ 
                                        position: 'absolute', 
                                        left: '14px', 
                                        top: '50%', 
                                        transform: 'translateY(-50%)', 
                                        color: '#a3a3a3' 
                                    }} 
                                />
                                <input 
                                    type="text"
                                    className="form-control"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ paddingLeft: '44px' }}
                                />
                            </div>
                            <div className='d-flex align-items-center gap-2'>
                                <span style={{ fontSize: '13px', color: '#737373' }}>{filteredContacts.length} contacts</span>
                                <div className='btn-group'>
                                    <button 
                                        className={`btn btn-sm ${viewMode === 'grid' ? 'btn-dark' : 'btn-outline-secondary'}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <FiGrid size={16} />
                                    </button>
                                    <button 
                                        className={`btn btn-sm ${viewMode === 'list' ? 'btn-dark' : 'btn-outline-secondary'}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <FiList size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {viewMode === 'grid' ? (
                    <div className='row g-4'>
                        {filteredContacts.map((contact) => (
                            <div key={contact.id} className='col-xl-3 col-lg-4 col-md-6'>
                                <ContactCard 
                                    id={contact.id}
                                    name={contact.name}
                                    email={contact.email}
                                    phone={contact.phone}
                                    status={contact.status}
                                    groups={contact.groups}
                                    lastActivity={contact.lastContact}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className='row'>
                        <div className='col-12'>
                            <div className='card'>
                                <div className='card-body p-0'>
                                    <div className='table-responsive'>
                                        <table className='table table-hover mb-0'>
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    <th>Phone</th>
                                                    <th>Status</th>
                                                    <th>Groups</th>
                                                    <th>Last Activity</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredContacts.map((contact) => (
                                                    <tr key={contact.id}>
                                                        <td>
                                                            <div className='d-flex align-items-center gap-3'>
                                                                <div 
                                                                    style={{
                                                                        width: '36px',
                                                                        height: '36px',
                                                                        borderRadius: '10px',
                                                                        background: 'linear-gradient(135deg, #c8f542 0%, #a8d435 100%)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontWeight: 600,
                                                                        fontSize: '12px',
                                                                        color: '#171717',
                                                                    }}
                                                                >
                                                                    {contact.name.split(' ').map(n => n[0]).join('')}
                                                                </div>
                                                                <Link href={`/people/contacts/${contact.id}`} className="fw-semibold" style={{ color: '#171717', textDecoration: 'none' }}>
                                                                    {contact.name}
                                                                </Link>
                                                            </div>
                                                        </td>
                                                        <td style={{ color: '#525252' }}>{contact.email}</td>
                                                        <td style={{ color: '#525252' }}>{contact.phone}</td>
                                                        <td>
                                                            <span className={`badge ${getStatusStyle(contact.status)}`}>
                                                                {contact.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {contact.groups.slice(0, 2).map((group, i) => (
                                                                <span key={i} className='badge me-1' style={{ background: '#f5f5f5', color: '#525252' }}>{group}</span>
                                                            ))}
                                                            {contact.groups.length > 2 && <span style={{ fontSize: '12px', color: '#a3a3a3' }}>+{contact.groups.length - 2}</span>}
                                                        </td>
                                                        <td style={{ color: '#737373', fontSize: '13px' }}>{contact.lastContact}</td>
                                                        <td>
                                                            <Link href={`/people/contacts/${contact.id}`} className="btn btn-sm btn-outline-secondary">View</Link>
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
                )}
            </div>
            <Footer />
        </>
    )
}

export default ContactsPage
