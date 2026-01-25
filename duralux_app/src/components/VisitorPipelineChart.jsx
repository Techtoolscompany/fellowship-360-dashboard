'use client'
import React from 'react'
import Link from 'next/link'
import CardHeader from '@/components/shared/CardHeader'
import CardLoader from '@/components/shared/CardLoader'
import useCardTitleActions from '@/hooks/useCardTitleActions'
import { visitorPipelineData } from '@/utils/fackData/churchStatisticsData'

const VisitorPipelineChart = () => {
    const { refreshKey, isRemoved, isExpanded, handleRefresh, handleExpand, handleDelete } = useCardTitleActions();

    if (isRemoved) {
        return null;
    }

    const total = visitorPipelineData.reduce((acc, item) => acc + item.count, 0)

    return (
        <div className="col-xxl-8">
            <div className={`card stretch stretch-full ${isExpanded ? "card-expand" : ""} ${refreshKey ? "card-loading" : ""}`}>
                <CardHeader title="Visitor Pipeline" refresh={handleRefresh} remove={handleDelete} expanded={handleExpand} />
                <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                        <div>
                            <h4 className="fw-bold mb-1">{total} Total Visitors</h4>
                            <p className="fs-12 text-muted mb-0">Current pipeline status</p>
                        </div>
                        <Link href="/engage/pipeline" className="btn btn-sm btn-light-brand">View Pipeline</Link>
                    </div>
                    <div className="row g-4">
                        {visitorPipelineData.map((item, index) => (
                            <div key={index} className="col-md-4 col-sm-6">
                                <div className="p-3 border border-dashed rounded-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className={`badge bg-soft-${item.color} text-${item.color}`}>{item.stage}</span>
                                        <span className="fs-11 text-muted">{item.percentage}%</span>
                                    </div>
                                    <div className="d-flex align-items-end gap-2">
                                        <h3 className="fw-bold mb-0">{item.count}</h3>
                                        <span className="fs-12 text-muted mb-1">visitors</span>
                                    </div>
                                    <div className="progress mt-2 ht-3">
                                        <div className={`progress-bar bg-${item.color}`} role="progressbar" style={{ width: `${item.percentage}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <CardLoader refreshKey={refreshKey} />
            </div>
        </div>
    )
}

export default VisitorPipelineChart
