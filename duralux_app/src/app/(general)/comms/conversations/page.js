'use client'
import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiSearch, FiPlus } from 'react-icons/fi'

const conversations = [
    { id: 1, name: 'Sarah Johnson', lastMessage: 'Thank you for the prayer!', time: '2 min ago', unread: true },
    { id: 2, name: 'Michael Davis', lastMessage: 'I would like to join a small group', time: '15 min ago', unread: true },
    { id: 3, name: 'Emily White', lastMessage: 'See you Sunday!', time: '1 hour ago', unread: false },
    { id: 4, name: 'Robert Brown', lastMessage: 'Got it, thanks!', time: '3 hours ago', unread: false },
    { id: 5, name: 'Jennifer Martinez', lastMessage: 'What time is the service?', time: 'Yesterday', unread: false },
    { id: 6, name: 'David Wilson', lastMessage: 'I can volunteer for that event', time: 'Yesterday', unread: false },
]

const selectedConversation = {
    name: 'Sarah Johnson',
    messages: [
        { id: 1, sender: 'Sarah Johnson', text: 'Hi! I wanted to thank you for praying for my family.', time: '10:30 AM', isOwn: false },
        { id: 2, sender: 'You', text: 'Of course! We are always here to support you. How is everyone doing?', time: '10:35 AM', isOwn: true },
        { id: 3, sender: 'Sarah Johnson', text: 'Much better now. My mother is recovering well.', time: '10:38 AM', isOwn: false },
        { id: 4, sender: 'You', text: 'That is wonderful news! We will continue to keep her in our prayers.', time: '10:40 AM', isOwn: true },
        { id: 5, sender: 'Sarah Johnson', text: 'Thank you for the prayer!', time: '10:42 AM', isOwn: false },
    ]
}

const ConversationsPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Conversations</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/comms/conversations">Comms</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Conversations</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> New Message</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-lg-4'>
                        <div className='card stretch stretch-full' style={{ height: '600px' }}>
                            <div className='card-header'>
                                <div className='input-group'>
                                    <span className='input-group-text bg-transparent border-end-0'><FiSearch size={16} /></span>
                                    <input type='text' className='form-control border-start-0' placeholder='Search conversations...' />
                                </div>
                            </div>
                            <div className='card-body p-0' style={{ overflowY: 'auto' }}>
                                {conversations.map((conv) => (
                                    <div key={conv.id} className={`d-flex align-items-center p-3 border-bottom cursor-pointer ${conv.id === 1 ? 'bg-light' : ''}`}>
                                        <div className='avatar avatar-md bg-primary text-white rounded-circle me-3 d-flex align-items-center justify-content-center' style={{width: '40px', height: '40px', minWidth: '40px'}}>
                                            {conv.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div className='flex-grow-1 overflow-hidden'>
                                            <div className='d-flex justify-content-between align-items-center'>
                                                <h6 className={`fs-13 mb-0 ${conv.unread ? 'fw-bold' : ''}`}>{conv.name}</h6>
                                                <small className='text-muted'>{conv.time}</small>
                                            </div>
                                            <p className={`text-truncate mb-0 fs-12 ${conv.unread ? 'fw-semibold text-dark' : 'text-muted'}`}>{conv.lastMessage}</p>
                                        </div>
                                        {conv.unread && <span className='badge bg-primary rounded-pill ms-2'>1</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className='col-lg-8'>
                        <div className='card stretch stretch-full' style={{ height: '600px' }}>
                            <div className='card-header d-flex align-items-center'>
                                <div className='avatar avatar-md bg-primary text-white rounded-circle me-3 d-flex align-items-center justify-content-center' style={{width: '40px', height: '40px'}}>
                                    SJ
                                </div>
                                <h6 className='mb-0'>{selectedConversation.name}</h6>
                            </div>
                            <div className='card-body' style={{ overflowY: 'auto', flex: 1 }}>
                                {selectedConversation.messages.map((msg) => (
                                    <div key={msg.id} className={`d-flex mb-3 ${msg.isOwn ? 'justify-content-end' : 'justify-content-start'}`}>
                                        <div className={`p-3 rounded ${msg.isOwn ? 'bg-primary text-white' : 'bg-light'}`} style={{ maxWidth: '70%' }}>
                                            <p className='mb-1 fs-13'>{msg.text}</p>
                                            <small className={msg.isOwn ? 'text-white-50' : 'text-muted'}>{msg.time}</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className='card-footer'>
                                <div className='input-group'>
                                    <input type='text' className='form-control' placeholder='Type a message...' />
                                    <button className='btn btn-primary'>Send</button>
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

export default ConversationsPage
