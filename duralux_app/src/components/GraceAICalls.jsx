'use client'
import React from 'react'
import Link from 'next/link'
import CardHeader from '@/components/shared/CardHeader'
import CardLoader from '@/components/shared/CardLoader'
import useCardTitleActions from '@/hooks/useCardTitleActions'
import { FiPhone, FiPhoneIncoming, FiPhoneOutgoing, FiCheckCircle, FiClock } from 'react-icons/fi'

const callStats = [
    { label: 'Total Calls', value: 156, icon: FiPhone, color: 'primary' },
    { label: 'Completed', value: 134, icon: FiCheckCircle, color: 'success' },
    { label: 'Pending', value: 22, icon: FiClock, color: 'warning' },
]

const recentCalls = [
    { id: 1, caller: 'Mike Davis', type: 'outgoing', intent: 'Follow-up', outcome: 'Connected', duration: '4:32', time: '2 hours ago' },
    { id: 2, caller: 'Sarah Johnson', type: 'outgoing', intent: 'Welcome', outcome: 'Voicemail', duration: '1:15', time: '3 hours ago' },
    { id: 3, caller: 'Emily White', type: 'incoming', intent: 'Prayer Request', outcome: 'Connected', duration: '8:45', time: '4 hours ago' },
    { id: 4, caller: 'John Peters', type: 'outgoing', intent: 'Follow-up', outcome: 'No Answer', duration: '0:30', time: '5 hours ago' },
]

const GraceAICalls = () => {
    const { refreshKey, isRemoved, isExpanded, handleRefresh, handleExpand, handleDelete } = useCardTitleActions();

    if (isRemoved) {
        return null;
    }

    return (
        <div className="col-xxl-4">
            <div className={`card stretch stretch-full ${isExpanded ? "card-expand" : ""} ${refreshKey ? "card-loading" : ""}`}>
                <CardHeader title="Grace AI Calls" refresh={handleRefresh} remove={handleDelete} expanded={handleExpand} />
                <div className="card-body">
                    <div className="row g-3 mb-4">
                        {callStats.map((stat, index) => (
                            <div key={index} className="col-4">
                                <div className={`p-3 rounded-3 bg-soft-${stat.color} text-center`}>
                                    <stat.icon className={`text-${stat.color} mb-2`} size={20} />
                                    <h4 className="fw-bold mb-0">{stat.value}</h4>
                                    <span className="fs-11 text-muted">{stat.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <h6 className="fs-13 fw-bold mb-3">Recent Calls</h6>
                    {recentCalls.map((call) => (
                        <div key={call.id} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                            <div className="d-flex align-items-center gap-3">
                                <div className={`wd-32 ht-32 rounded-circle bg-soft-${call.outcome === 'Connected' ? 'success' : 'warning'} d-flex align-items-center justify-content-center`}>
                                    {call.type === 'outgoing' ? <FiPhoneOutgoing size={14} className="text-success" /> : <FiPhoneIncoming size={14} className="text-info" />}
                                </div>
                                <div>
                                    <Link href={`/grace/calls/${call.id}`} className="fw-semibold text-dark fs-13">{call.caller}</Link>
                                    <div className="fs-11 text-muted">{call.intent} - {call.duration}</div>
                                </div>
                            </div>
                            <span className={`badge bg-soft-${call.outcome === 'Connected' ? 'success' : call.outcome === 'Voicemail' ? 'info' : 'warning'} text-${call.outcome === 'Connected' ? 'success' : call.outcome === 'Voicemail' ? 'info' : 'warning'}`}>
                                {call.outcome}
                            </span>
                        </div>
                    ))}
                </div>
                <Link href="/grace/calls" className="card-footer fs-11 fw-bold text-uppercase text-center py-4">View All Calls</Link>
                <CardLoader refreshKey={refreshKey} />
            </div>
        </div>
    )
}

export default GraceAICalls
