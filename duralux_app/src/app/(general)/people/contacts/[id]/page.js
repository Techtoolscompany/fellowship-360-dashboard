'use client'
import React, { useState, useEffect } from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiMail, FiPhone, FiMessageSquare, FiEdit, FiCalendar, FiUser, FiX, FiCheck, FiDollarSign, FiArrowLeft } from 'react-icons/fi'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/components/shared/Toast'
import Link from 'next/link'

const ContactDetailPage = () => {
    const params = useParams()
    const router = useRouter()
    const toast = useToast()
    const [contact, setContact] = useState(null)
    const [donations, setDonations] = useState([])
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({})
    const [saving, setSaving] = useState(false)

    const fetchContact = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', params.id)
            .single()

        if (error) {
            console.error('Error fetching contact:', error)
            toast.error('Failed to load contact')
        } else {
            setContact(data)
            setEditForm(data)
        }
        setLoading(false)
    }

    const fetchDonations = async () => {
        const { data, error } = await supabase
            .from('donations')
            .select('*')
            .eq('contact_id', params.id)
            .order('donation_date', { ascending: false })

        if (error) {
            console.error('Error fetching donations:', error)
        } else {
            setDonations(data || [])
        }
    }

    useEffect(() => {
        if (params.id) {
            fetchContact()
            fetchDonations()
        }
    }, [params.id])

    const handleEditClick = () => {
        setEditForm({ ...contact })
        setIsEditing(true)
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditForm({ ...contact })
    }

    const handleSaveEdit = async () => {
        if (!editForm.first_name || !editForm.last_name) {
            toast.error('First and last name are required')
            return
        }

        setSaving(true)
        const { error } = await supabase
            .from('contacts')
            .update({
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                email: editForm.email,
                phone: editForm.phone,
                member_status: editForm.member_status,
                notes: editForm.notes,
            })
            .eq('id', params.id)

        if (error) {
            console.error('Error updating contact:', error)
            toast.error('Failed to update contact')
        } else {
            toast.success('Contact updated successfully')
            setIsEditing(false)
            fetchContact()
        }
        setSaving(false)
    }

    const handleInputChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }))
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this contact?')) return
        const { error } = await supabase.from('contacts').delete().eq('id', params.id)
        if (error) {
            toast.error('Failed to delete contact')
        } else {
            toast.success('Contact deleted')
            router.push('/people/contacts')
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

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    }

    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'member': return 'bg-soft-success text-success'
            case 'visitor': return 'bg-soft-info text-info'
            case 'volunteer': return 'bg-soft-primary text-primary'
            case 'leader': return 'bg-soft-warning text-warning'
            default: return 'bg-soft-secondary text-secondary'
        }
    }

    const totalGiving = donations.reduce((sum, d) => sum + (d.amount || 0), 0)

    if (loading) {
        return (
            <>
                <PageHeader>
                    <h2 className="fs-16 fw-bold mb-0">Loading...</h2>
                </PageHeader>
                <div className='main-content'>
                    <div className="text-center py-5">
                        <div className="spinner-border" role="status" style={{ color: 'var(--accent-primary, #bbff00)' }}>
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                </div>
                <Footer />
            </>
        )
    }

    if (!contact) {
        return (
            <>
                <PageHeader>
                    <h2 className="fs-16 fw-bold mb-0">Contact Not Found</h2>
                </PageHeader>
                <div className='main-content'>
                    <div className="text-center py-5">
                        <p style={{ color: '#737373' }}>This contact could not be found.</p>
                        <Link href="/people/contacts" className="btn btn-primary btn-sm">
                            <FiArrowLeft className="me-1" /> Back to Contacts
                        </Link>
                    </div>
                </div>
                <Footer />
            </>
        )
    }

    const fullName = `${contact.first_name} ${contact.last_name}`
    const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`

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
                                <li className="breadcrumb-item active" aria-current="page">{fullName}</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <Link href="/people/contacts" className="btn btn-outline-secondary btn-sm">
                            <FiArrowLeft size={14} className="me-1" /> Back
                        </Link>
                        <button className="btn btn-primary btn-sm" onClick={handleEditClick}>
                            <FiEdit size={14} className="me-1" /> Edit
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={handleDelete}>
                            <FiX size={14} className="me-1" /> Delete
                        </button>
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
                                <div
                                    className='mx-auto mb-3 d-flex align-items-center justify-content-center'
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '20px',
                                        background: 'linear-gradient(135deg, #c8f542 0%, #a8d435 100%)',
                                        fontWeight: 700,
                                        fontSize: '24px',
                                        color: '#171717',
                                    }}
                                >
                                    {initials}
                                </div>
                                <h5 className='mb-1'>{fullName}</h5>
                                <span className={`badge ${getStatusStyle(contact.member_status)} mb-3`}>
                                    {contact.member_status}
                                </span>
                                <div className='text-start mt-4'>
                                    {contact.email && (
                                        <p className='mb-2' style={{ fontSize: '14px', color: '#525252' }}>
                                            <FiMail className='me-2' style={{ color: '#737373' }} /> {contact.email}
                                        </p>
                                    )}
                                    {contact.phone && (
                                        <p className='mb-2' style={{ fontSize: '14px', color: '#525252' }}>
                                            <FiPhone className='me-2' style={{ color: '#737373' }} /> {formatPhone(contact.phone)}
                                        </p>
                                    )}
                                    <p className='mb-0' style={{ fontSize: '14px', color: '#525252' }}>
                                        <FiCalendar className='me-2' style={{ color: '#737373' }} />
                                        Added {new Date(contact.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {contact.notes && (
                            <div className='card stretch stretch-full'>
                                <div className='card-header'>
                                    <h5 className='card-title'>Notes</h5>
                                </div>
                                <div className='card-body'>
                                    <p className='mb-0' style={{ fontSize: '14px', color: '#525252', lineHeight: '1.6' }}>
                                        {contact.notes}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Giving Summary */}
                        <div className='card stretch stretch-full'>
                            <div className='card-header'>
                                <h5 className='card-title'>Giving Summary</h5>
                            </div>
                            <div className='card-body'>
                                <div className='text-center mb-3'>
                                    <p className='mb-1' style={{ fontSize: '13px', color: '#737373' }}>Total Giving</p>
                                    <h3 style={{ fontSize: '28px', fontWeight: 700, color: '#171717' }}>
                                        {formatCurrency(totalGiving)}
                                    </h3>
                                    <p style={{ fontSize: '13px', color: '#737373' }}>
                                        {donations.length} donation{donations.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                {donations.length > 0 && (
                                    <div>
                                        {/* Fund breakdown */}
                                        {Object.entries(
                                            donations.reduce((acc, d) => {
                                                acc[d.fund] = (acc[d.fund] || 0) + d.amount
                                                return acc
                                            }, {})
                                        ).map(([fund, amount]) => (
                                            <div key={fund} className='d-flex justify-content-between align-items-center py-2 border-bottom'>
                                                <span style={{ fontSize: '13px', color: '#525252' }}>{fund}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
                                                    {formatCurrency(amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full'>
                            <div className='card-header d-flex justify-content-between align-items-center'>
                                <h5 className='card-title mb-0'>Donation History</h5>
                            </div>
                            <div className='card-body p-0'>
                                {donations.length === 0 ? (
                                    <div className="text-center py-5">
                                        <FiDollarSign size={32} style={{ color: '#d4d4d4' }} />
                                        <p className="mt-2" style={{ color: '#737373', fontSize: '14px' }}>
                                            No donations recorded yet.
                                        </p>
                                    </div>
                                ) : (
                                    <div className='table-responsive'>
                                        <table className='table table-hover mb-0'>
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Amount</th>
                                                    <th>Fund</th>
                                                    <th>Method</th>
                                                    <th>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {donations.map((donation) => (
                                                    <tr key={donation.id}>
                                                        <td style={{ fontSize: '13px' }}>
                                                            {new Date(donation.donation_date).toLocaleDateString('en-US', {
                                                                month: 'short', day: 'numeric', year: 'numeric'
                                                            })}
                                                        </td>
                                                        <td style={{ fontSize: '13px', fontWeight: 600 }}>
                                                            {formatCurrency(donation.amount)}
                                                        </td>
                                                        <td>
                                                            <span className='badge bg-soft-primary text-primary'>
                                                                {donation.fund}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '13px', color: '#525252', textTransform: 'capitalize' }}>
                                                            {donation.method}
                                                        </td>
                                                        <td style={{ fontSize: '13px', color: '#737373' }}>
                                                            {donation.notes || '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Contact Modal */}
            {isEditing && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Edit Contact</h5>
                                <button type="button" className="btn-close" onClick={handleCancelEdit}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label">First Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editForm.first_name || ''}
                                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Last Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editForm.last_name || ''}
                                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={editForm.email || ''}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Phone</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            value={editForm.phone || ''}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Status</label>
                                        <select
                                            className="form-select"
                                            value={editForm.member_status || 'visitor'}
                                            onChange={(e) => handleInputChange('member_status', e.target.value)}
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
                                            rows="3"
                                            value={editForm.notes || ''}
                                            onChange={(e) => handleInputChange('notes', e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                                    <FiX className="me-1" /> Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                                    <FiCheck className="me-1" /> {saving ? 'Saving...' : 'Save Changes'}
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
