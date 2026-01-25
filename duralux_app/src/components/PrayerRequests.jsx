'use client'
import React from 'react'
import Link from 'next/link'
import CardHeader from '@/components/shared/CardHeader'
import CardLoader from '@/components/shared/CardLoader'
import useCardTitleActions from '@/hooks/useCardTitleActions'
import { prayerRequestsData } from '@/utils/fackData/churchStatisticsData'

const PrayerRequests = ({ title }) => {
    const { refreshKey, isRemoved, isExpanded, handleRefresh, handleExpand, handleDelete } = useCardTitleActions();

    if (isRemoved) {
        return null;
    }
    return (
        <div className="col-xxl-4">
            <div className={`card stretch stretch-full ${isExpanded ? "card-expand" : ""} ${refreshKey ? "card-loading" : ""}`}>
                <CardHeader title={title} refresh={handleRefresh} remove={handleDelete} expanded={handleExpand} />
                <div className="card-body">
                    {prayerRequestsData.map((prayer) => (
                        <div key={prayer.id} className="p-3 mb-3 border border-dashed rounded-3">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <span className="fw-semibold">{prayer.name}</span>
                                        <span className={`badge bg-soft-${prayer.status === 'active' ? 'warning' : 'success'} text-${prayer.status === 'active' ? 'warning' : 'success'}`}>
                                            {prayer.status === 'active' ? 'Active' : 'Answered'}
                                        </span>
                                    </div>
                                    <p className="mb-1 text-muted fs-13">{prayer.request}</p>
                                    <span className="fs-11 text-muted">{prayer.date}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <Link href="/care/prayer-requests" className="card-footer fs-11 fw-bold text-uppercase text-center py-4">View All Requests</Link>
                <CardLoader refreshKey={refreshKey} />
            </div>
        </div>
    )
}

export default PrayerRequests
