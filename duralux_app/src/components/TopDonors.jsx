'use client'
import React from 'react'
import Link from 'next/link'
import CardHeader from '@/components/shared/CardHeader'
import CardLoader from '@/components/shared/CardLoader'
import useCardTitleActions from '@/hooks/useCardTitleActions'
import { topDonorsData } from '@/utils/fackData/churchStatisticsData'

const TopDonors = ({ title }) => {
    const { refreshKey, isRemoved, isExpanded, handleRefresh, handleExpand, handleDelete } = useCardTitleActions();

    if (isRemoved) {
        return null;
    }
    return (
        <div className="col-xxl-4">
            <div className={`card stretch stretch-full ${isExpanded ? "card-expand" : ""} ${refreshKey ? "card-loading" : ""}`}>
                <CardHeader title={title} refresh={handleRefresh} remove={handleDelete} expanded={handleExpand} />
                <div className="card-body custom-card-action p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th className="ps-4">Donor</th>
                                    <th>This Week</th>
                                    <th>YTD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topDonorsData.map((donor) => (
                                    <tr key={donor.id}>
                                        <td className="ps-4">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="wd-36 ht-36 bg-soft-primary text-primary rounded-circle d-flex align-items-center justify-content-center">
                                                    {donor.name.charAt(0)}
                                                </div>
                                                <span className="fw-semibold">{donor.name}</span>
                                            </div>
                                        </td>
                                        <td className="fw-bold text-success">{donor.amount}</td>
                                        <td className="text-muted">{donor.ytd}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <Link href="/giving/donors" className="card-footer fs-11 fw-bold text-uppercase text-center py-4">View All Donors</Link>
                <CardLoader refreshKey={refreshKey} />
            </div>
        </div>
    )
}

export default TopDonors
