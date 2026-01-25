'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
    FiSearch, FiHome, FiUsers, FiTarget, FiMail, FiPhone, FiHeart, 
    FiCalendar, FiDollarSign, FiBarChart2, FiSettings, FiShield,
    FiX, FiCommand
} from 'react-icons/fi'

const commands = [
    { id: 'home', name: 'Go to Dashboard', icon: FiHome, path: '/home', category: 'Navigation' },
    { id: 'people', name: 'View People', icon: FiUsers, path: '/people/contacts', category: 'Navigation' },
    { id: 'segments', name: 'View Segments', icon: FiUsers, path: '/people/segments', category: 'Navigation' },
    { id: 'pipeline', name: 'Visitor Pipeline', icon: FiTarget, path: '/engage/pipeline', category: 'Navigation' },
    { id: 'tasks', name: 'View Tasks', icon: FiTarget, path: '/engage/tasks', category: 'Navigation' },
    { id: 'conversations', name: 'Conversations', icon: FiMail, path: '/comms/conversations', category: 'Navigation' },
    { id: 'broadcasts', name: 'Broadcasts', icon: FiMail, path: '/comms/broadcasts', category: 'Navigation' },
    { id: 'grace-calls', name: 'Grace AI Calls', icon: FiPhone, path: '/grace/calls', category: 'Navigation' },
    { id: 'prayer', name: 'Prayer Requests', icon: FiHeart, path: '/care/prayer-requests', category: 'Navigation' },
    { id: 'calendar', name: 'Calendar', icon: FiCalendar, path: '/scheduling/calendar', category: 'Navigation' },
    { id: 'appointments', name: 'Appointments', icon: FiCalendar, path: '/scheduling/appointments', category: 'Navigation' },
    { id: 'volunteers', name: 'Volunteers', icon: FiUsers, path: '/scheduling/volunteers', category: 'Navigation' },
    { id: 'donations', name: 'Donations', icon: FiDollarSign, path: '/giving/donations', category: 'Navigation' },
    { id: 'donors', name: 'Donors', icon: FiDollarSign, path: '/giving/donors', category: 'Navigation' },
    { id: 'pledges', name: 'Pledges', icon: FiDollarSign, path: '/giving/pledges', category: 'Navigation' },
    { id: 'reports', name: 'Reports Overview', icon: FiBarChart2, path: '/reports/overview', category: 'Navigation' },
    { id: 'settings', name: 'Settings', icon: FiSettings, path: '/settings/church-profile', category: 'Navigation' },
    { id: 'admin', name: 'Admin Panel', icon: FiShield, path: '/admin/churches', category: 'Navigation' },
]

const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef(null)
    const router = useRouter()

    const filteredCommands = commands.filter(cmd => 
        cmd.name.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
    )

    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = []
        acc[cmd.category].push(cmd)
        return acc
    }, {})

    const handleKeyDown = useCallback((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault()
            setIsOpen(prev => !prev)
            setSearch('')
            setSelectedIndex(0)
        }

        if (!isOpen) return

        if (e.key === 'Escape') {
            setIsOpen(false)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
            e.preventDefault()
            executeCommand(filteredCommands[selectedIndex])
        }
    }, [isOpen, filteredCommands, selectedIndex])

    const executeCommand = (command) => {
        if (command.path) {
            router.push(command.path)
        }
        setIsOpen(false)
        setSearch('')
    }

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    useEffect(() => {
        setSelectedIndex(0)
    }, [search])

    if (!isOpen) return null

    let commandIndex = 0

    return (
        <>
            <div 
                className="command-palette-overlay"
                onClick={() => setIsOpen(false)}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9998,
                    animation: 'fadeIn 0.15s ease-out',
                }}
            />
            <div
                className="command-palette"
                style={{
                    position: 'fixed',
                    top: '20%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: '560px',
                    background: 'var(--card-bg, #ffffff)',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    animation: 'slideDown 0.2s ease-out',
                }}
            >
                <style jsx global>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideDown {
                        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                        to { opacity: 1; transform: translateX(-50%) translateY(0); }
                    }
                    .app-skin-dark .command-palette {
                        background: #1e293b;
                        border: 1px solid #334155;
                    }
                    .app-skin-dark .command-palette-input {
                        background: #1e293b !important;
                        color: #e2e8f0 !important;
                        border-color: #334155 !important;
                    }
                    .app-skin-dark .command-item {
                        color: #e2e8f0;
                    }
                    .app-skin-dark .command-item:hover,
                    .app-skin-dark .command-item.selected {
                        background: #334155 !important;
                    }
                    .app-skin-dark .command-category {
                        color: #94a3b8;
                    }
                `}</style>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    gap: '12px',
                }}>
                    <FiSearch size={20} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder="Type a command or search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            fontSize: '16px',
                            background: 'transparent',
                        }}
                    />
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        padding: '4px 8px',
                        background: '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#6b7280',
                    }}>
                        <FiCommand size={12} />
                        <span>K</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#9ca3af',
                        }}
                    >
                        <FiX size={20} />
                    </button>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                    {Object.entries(groupedCommands).map(([category, cmds]) => (
                        <div key={category} style={{ marginBottom: '8px' }}>
                            <div 
                                className="command-category"
                                style={{ 
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    color: '#9ca3af',
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {category}
                            </div>
                            {cmds.map((cmd) => {
                                const currentIndex = commandIndex++
                                const Icon = cmd.icon
                                return (
                                    <div
                                        key={cmd.id}
                                        className={`command-item ${currentIndex === selectedIndex ? 'selected' : ''}`}
                                        onClick={() => executeCommand(cmd)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: currentIndex === selectedIndex ? '#f3f4f6' : 'transparent',
                                            transition: 'background 0.15s ease',
                                        }}
                                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: '#e0e7ff',
                                            color: '#4f46e5',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Icon size={16} />
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: 500 }}>{cmd.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                    {filteredCommands.length === 0 && (
                        <div style={{ 
                            padding: '32px', 
                            textAlign: 'center', 
                            color: '#9ca3af',
                        }}>
                            No commands found for "{search}"
                        </div>
                    )}
                </div>
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    fontSize: '12px',
                    color: '#9ca3af',
                }}>
                    <span><kbd style={{ 
                        padding: '2px 6px', 
                        background: '#f3f4f6', 
                        borderRadius: '4px',
                        marginRight: '4px',
                    }}>↑↓</kbd> Navigate</span>
                    <span><kbd style={{ 
                        padding: '2px 6px', 
                        background: '#f3f4f6', 
                        borderRadius: '4px',
                        marginRight: '4px',
                    }}>↵</kbd> Select</span>
                    <span><kbd style={{ 
                        padding: '2px 6px', 
                        background: '#f3f4f6', 
                        borderRadius: '4px',
                        marginRight: '4px',
                    }}>Esc</kbd> Close</span>
                </div>
            </div>
        </>
    )
}

export default CommandPalette