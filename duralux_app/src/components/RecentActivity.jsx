'use client'
import React from 'react'
import CardHeader from '@/components/shared/CardHeader'
import CardLoader from '@/components/shared/CardLoader'
import useCardTitleActions from '@/hooks/useCardTitleActions'
import { recentActivityData } from '@/utils/fackData/churchStatisticsData'
import { FiUser, FiPhone, FiHeart, FiDollarSign, FiCalendar } from 'react-icons/fi'

const getActivityIcon = (type) => {
    switch (type) {
        case 'visitor': return <FiUser className="text-primary" />;
        case 'call': return <FiPhone className="text-success" />;
        case 'prayer': return <FiHeart className="text-warning" />;
        case 'donation': return <FiDollarSign className="text-info" />;
        case 'event': return <FiCalendar className="text-secondary" />;
        default: return <FiUser className="text-muted" />;
    }
}

const RecentActivity = ({ title }) => {
    const { refreshKey, isRemoved, isExpanded, handleRefresh, handleExpand, handleDelete } = useCardTitleActions();

    if (isRemoved) {
        return null;
    }
    return (
        <div className="col-xxl-4">
            <div className={`card stretch stretch-full ${isExpanded ? "card-expand" : ""} ${refreshKey ? "card-loading" : ""}`}>
                <CardHeader title={title} refresh={handleRefresh} remove={handleDelete} expanded={handleExpand} />
                <div className="card-body custom-card-action p-0">
                    <ul className="list-unstyled mb-0">
                        {recentActivityData.map((activity) => (
                            <li key={activity.id} className="px-4 py-3 border-bottom d-flex align-items-start gap-3">
                                <div className={`wd-36 ht-36 bg-soft-${activity.color} rounded-circle d-flex align-items-center justify-content-center flex-shrink-0`}>
                                    {getActivityIcon(activity.type)}
                                </div>
                                <div className="flex-grow-1">
                                    <p className="mb-1 fs-13">{activity.message}</p>
                                    <small className="text-muted fs-11">{activity.time}</small>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <CardLoader refreshKey={refreshKey} />
            </div>
        </div>
    )
}

export default RecentActivity
