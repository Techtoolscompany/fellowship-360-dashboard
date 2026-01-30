'use client'
import React, { useState, useEffect } from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import ContactCard from '@/components/shared/ContactCard'
import Link from 'next/link'
import { FiPlus, FiDownload, FiFilter, FiGrid, FiList, FiSearch, FiX, FiCheck } from 'react-icons/fi'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/components/shared/Toast'

const ContactsPage = () => {
    const toast = useToast()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [newContact, setNewContact] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        member_status: 'visitor',
        notes: '',
    })
    const [saving, setSaving] = useState(false)

    const fetchContacts = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching contacts:', error)
            toast.error('Failed to load contacts')
        } else {
            setContacts(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchContacts()
    }, [])

    const filteredContacts = contacts.filter(contact => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase()
        const query = searchQuery.toLowerCase()
        return fullName.includes(query) ||
               (contact.email && contact.email.toLowerCase().includes(query)) ||
               (contact.phone && contact.phone.includes(query))
    })

    const handleAddContact = async () => {
        if (!newContact.first_name || !newContact.last_name) {
            toast.error('First and last name are required')
            return
        }

        setSaving(true)
        const { data, error } = await supabase
            .from('contacts')
            .insert([{
                ...newContact,
                tenant_id: '11111111-1111-1111-1111-111111111111',
            }])
            .select()

        if (error) {
            console.error('Error adding contact:', error)
            toast.error('Failed to add contact')
        } else {
            toast.success(`${newContact.first_name} ${newContact.last_name} added`)
            setShowAddModal(false)
            setNewContact({ first_name: '', last_name: '', email: '', phone: '', member_status: 'visitor', notes: '' })
            fetchContacts()
        }
        setSaving(false)
    }

    const handleDeleteContact = async (id) => {
        const { error } = await supabase.from('contacts').delete().eq('id', id)
        if (error) {
            toast.error('Failed to delete contact')
        } else {
            toast.success('Contact deleted')
            fetchContacts()
        }
    }

    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'member':
                return 'bg-soft-success text-success'
            case 'visitor':
                return 'bg-soft-info text-info'
            case 'volunteer':
                return 'bg-soft-primary text-primary'
            case 'leader':
                return 'bg-soft-warning text-warning'
            default:
                return 'bg-soft-secondary text-secondary'
        }
    }

    const formatPhone = (phone) => {
        if (!phone) return ''
        const digits = phone.replace(/\D/g, '')
        if (digits.length === 10) {
            return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
        }
        return phone
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
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                            <FiPlus size={14} className="me-1" /> Add Contact
                        </button>
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
                                        color: 'var(--ds-text-muted, #a3a3a3)'
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
                                <span style={{ fontSize: '13px', color: 'var(--ds-text-secondary, #737373)' }}>
                                    {loading ? 'Loading...' : `${filteredContacts.length} contacts`}
                                </span>
                                <div className='btn-group'>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => setViewMode('grid')}
                                        style={{
                                            background: viewMode === 'grid' ? 'var(--accent-primary-light, #c8f542)' : 'transparent',
                                            color: viewMode === 'grid' ? 'var(--ds-text-primary, #171717)' : 'var(--ds-text-secondary, #737373)',
                                            border: '1px solid var(--ds-border-primary, #e5e5e5)',
                                            borderRight: 'none',
                                        }}
                                    >
                                        <FiGrid size={16} />
                                    </button>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => setViewMode('list')}
                                        style={{
                                            background: viewMode === 'list' ? 'var(--accent-primary-light, #c8f542)' : 'transparent',
                                            color: viewMode === 'list' ? 'var(--ds-text-primary, #171717)' : 'var(--ds-text-secondary, #737373)',
                                            border: '1px solid var(--ds-border-primary, #e5e5e5)',
                                        }}
                                    >
                                        <FiList size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border" role="status" style={{ color: 'var(--accent-primary, #bbff00)' }}>
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-5">
                        <p style={{ color: 'var(--ds-text-secondary, #737373)', fontSize: '14px' }}>
                            {searchQuery ? 'No contacts match your search.' : 'No contacts yet. Add your first contact!'}
                        </p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className='row g-4'>
                        {filteredContacts.map((contact) => (
                            <div key={contact.id} className='col-xl-3 col-lg-4 col-md-6'>
                                <ContactCard
                                    id={contact.id}
                                    name={`${contact.first_name} ${contact.last_name}`}
                                    email={contact.email}
                                    phone={formatPhone(contact.phone)}
                                    status={contact.member_status}
                                    groups={[]}
                                    lastActivity={new Date(contact.created_at).toLocaleDateString()}
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
                                                    <th>Added</th>
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
                                                                        background: 'linear-gradient(135deg, var(--accent-primary-light, #c8f542) 0%, var(--accent-primary-dark, #a8d435) 100%)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontWeight: 600,
                                                                        fontSize: '12px',
                                                                        color: '#171717',
                                                                    }}
                                                                >
                                                                    {contact.first_name[0]}{contact.last_name[0]}
                                                                </div>
                                                                <Link href={`/people/contacts/${contact.id}`} className="fw-semibold" style={{ color: 'var(--ds-text-primary, #171717)', textDecoration: 'none' }}>
                                                                    {contact.first_name} {contact.last_name}
                                                                </Link>
                                                            </div>
                                                        </td>
                                                        <td style={{ color: 'var(--ds-text-secondary, #525252)' }}>{contact.email}</td>
                                                        <td style={{ color: 'var(--ds-text-secondary, #525252)' }}>{formatPhone(contact.phone)}</td>
                                                        <td>
                                                            <span className={`badge ${getStatusStyle(contact.member_status)}`}>
                                                                {contact.member_status}
                                                            </span>
                                                        </td>
                                                        <td style={{ color: 'var(--ds-text-muted, #737373)', fontSize: '13px' }}>
                                                            {new Date(contact.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td>
                                                            <div className="d-flex gap-1">
                                                                <Link href={`/people/contacts/${contact.id}`} className="btn btn-sm btn-outline-secondary">View</Link>
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger"
                                                                    onClick={() => handleDeleteContact(contact.id)}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
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

            {/* Add Contact Modal */}
            {showAddModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Add Contact</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label">First Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newContact.first_name}
                                            onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Last Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newContact.last_name}
                                            onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={newContact.email}
                                            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Phone</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            value={newContact.phone}
                                            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Status</label>
                                        <select
                                            className="form-select"
                                            value={newContact.member_status}
                                            onChange={(e) => setNewContact({ ...newContact, member_status: e.target.value })}
                                        >
                                            <option value="visitor">Visitor</option>
                                            <option value="member">Member</option>
                                            <option value="volunteer">Volunteer</option>
                                            <option value="leader">Leader</option>
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Notes</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            value={newContact.notes}
                                            onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    <FiX className="me-1" /> Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleAddContact} disabled={saving}>
                                    <FiCheck className="me-1" /> {saving ? 'Saving...' : 'Add Contact'}
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

export default ContactsPage
