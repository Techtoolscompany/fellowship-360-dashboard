'use client'
import React from 'react'
import Link from 'next/link'
import { FiPhone, FiMail, FiMoreVertical, FiMessageSquare, FiCalendar } from 'react-icons/fi'

const ContactCard = ({ 
    id,
    name, 
    email, 
    phone, 
    status = 'Member',
    avatar,
    groups = [],
    lastActivity,
    onClick,
    compact = false
}) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'
    
    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'member':
                return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }
            case 'visitor':
                return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }
            case 'regular attendee':
                return { bg: 'rgba(200, 245, 66, 0.15)', color: '#171717' }
            case 'leader':
                return { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }
            default:
                return { bg: 'rgba(115, 115, 115, 0.1)', color: '#737373' }
        }
    }
    
    const statusStyle = getStatusStyle(status)
    
    if (compact) {
        return (
            <div 
                className="contact-card-compact"
                onClick={onClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #f5f5f5',
                    cursor: onClick ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                }}
            >
                <div 
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '360px',
                        background: '#bbff00',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '14px',
                        color: '#171717',
                        flexShrink: 0,
                    }}
                >
                    {avatar ? <img src={avatar} alt={name} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px'}} /> : initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#171717', marginBottom: '2px' }}>{name}</div>
                    <div style={{ fontSize: '12px', color: '#737373', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                </div>
                <span 
                    style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: statusStyle.bg,
                        color: statusStyle.color,
                    }}
                >
                    {status}
                </span>
            </div>
        )
    }
    
    return (
        <div 
            className="contact-card"
            style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #f5f5f5',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
            }}
        >
            <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div 
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '360px',
                            background: '#bbff00',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '18px',
                            color: '#171717',
                        }}
                    >
                        {avatar ? <img src={avatar} alt={name} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '14px'}} /> : initials}
                    </div>
                    <button 
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: '1px solid #e5e5e5',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#737373',
                        }}
                    >
                        <FiMoreVertical size={16} />
                    </button>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 4px 0' }}>{name}</h4>
                    <span 
                        style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 500,
                            background: statusStyle.bg,
                            color: statusStyle.color,
                        }}
                    >
                        {status}
                    </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#525252' }}>
                        <FiMail size={14} style={{ color: '#a3a3a3' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                    </div>
                    {phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#525252' }}>
                            <FiPhone size={14} style={{ color: '#a3a3a3' }} />
                            <span>{phone}</span>
                        </div>
                    )}
                </div>
                
                {groups.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {groups.slice(0, 2).map((group, i) => (
                            <span 
                                key={i}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    background: '#f5f5f5',
                                    color: '#525252',
                                }}
                            >
                                {group}
                            </span>
                        ))}
                        {groups.length > 2 && (
                            <span style={{ fontSize: '11px', color: '#a3a3a3', padding: '4px 0' }}>+{groups.length - 2} more</span>
                        )}
                    </div>
                )}
                
                {lastActivity && (
                    <div style={{ fontSize: '12px', color: '#a3a3a3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiCalendar size={12} />
                        Last activity: {lastActivity}
                    </div>
                )}
            </div>
            
            <div style={{ 
                display: 'flex', 
                borderTop: '1px solid #f5f5f5',
                background: '#fafafa',
            }}>
                <Link
                    href={`/people/contacts/${id || 1}`}
                    style={{
                        flex: 1,
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#525252',
                        textDecoration: 'none',
                        borderRight: '1px solid #f5f5f5',
                        transition: 'background 0.15s ease',
                    }}
                >
                    View Profile
                </Link>
                <button
                    style={{
                        flex: 1,
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#525252',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                    }}
                >
                    <FiMessageSquare size={14} />
                    Message
                </button>
            </div>
        </div>
    )
}

export default ContactCard
