'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { FiGrid, FiBarChart2, FiUsers, FiTrendingUp, FiDatabase, FiSettings, FiBell, FiMoon, FiSun } from 'react-icons/fi'

const FigmaSidebar = () => {
    const [isDarkMode, setIsDarkMode] = useState(false)
    const [activeItem, setActiveItem] = useState(0)
    
    const navItems = [
        { icon: FiGrid, href: '/home' },
        { icon: FiBarChart2, href: '/reports/overview' },
        { icon: FiUsers, href: '/people/contacts' },
        { icon: FiTrendingUp, href: '/giving/donations' },
        { icon: FiDatabase, href: '/settings/church-profile' },
    ]
    
    return (
        <div style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            width: '96px',
            background: '#f2f2f2',
            border: '1px solid #e9e9e9',
            borderRadius: '0 20px 20px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 24px',
            gap: '80px',
            zIndex: 1000,
        }}>
            <div style={{
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <path d="M24 4L4 24L24 44L44 24L24 4Z" fill="#343330" />
                    <path d="M24 12L12 24L24 36L36 24L24 12Z" fill="#f2f2f2" />
                </svg>
            </div>
            
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {navItems.map((item, index) => {
                    const Icon = item.icon
                    const isActive = index === activeItem
                    return (
                        <Link
                            key={index}
                            href={item.href}
                            onClick={() => setActiveItem(index)}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                background: isActive ? '#bbff00' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s ease',
                            }}
                        >
                            <Icon size={24} color="#343330" />
                        </Link>
                    )
                })}
            </div>
            
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                alignItems: 'center',
            }}>
                <button style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                }}>
                    <FiSettings size={24} color="#343330" />
                </button>
                <div style={{ position: 'relative' }}>
                    <FiBell size={24} color="#343330" />
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-6px',
                        background: 'red',
                        borderRadius: '360px',
                        padding: '1px 4px',
                        fontSize: '6px',
                        color: 'white',
                        fontWeight: 500,
                    }}>5+</div>
                </div>
            </div>
            
            <div style={{
                width: '100%',
                background: '#343330',
                borderRadius: '360px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}>
                <button
                    onClick={() => setIsDarkMode(true)}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '360px',
                        background: isDarkMode ? '#bbff00' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                    }}
                >
                    <FiMoon size={24} color={isDarkMode ? '#343330' : 'white'} />
                </button>
                <FiSun size={24} color="white" style={{ marginLeft: '4px' }} />
            </div>
        </div>
    )
}

export default FigmaSidebar
