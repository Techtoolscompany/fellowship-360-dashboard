import React from 'react'
import { FiMoreVertical } from 'react-icons/fi'
import { crmStatisticsData } from '@/utils/fackData/crmStatisticsData'
import getIcon from '@/utils/getIcon'
import Link from 'next/link'


const SiteOverviewStatistics = () => {
    return (
        <>
            {
                crmStatisticsData.map(({ id, completed_number, progress, progress_info, title, total_number, icon }) => (
                    <div key={id} className="col-xxl-3 col-md-6">
                        <div className="card stretch stretch-full short-info-card">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between mb-4">
                                    <div className="d-flex gap-4 align-items-center">
                                        <div className="avatar-text avatar-lg bg-gray-200 icon">
                                            {React.cloneElement(getIcon(icon), { size: "16" })}
                                        </div>
                                        <div>
                                            <div className="fs-4 fw-bold text-dark">
                                                <span className="counter">{completed_number ? completed_number + "/" : ""}</span>
                                                <span className="counter">{total_number}</span>
                                            </div>
                                            <h3 className="fs-13 fw-semibold text-truncate-1-line">{title}</h3>
                                        </div>
                                    </div>
                                    <Link href="#" className="lh-1">
                                        <FiMoreVertical className='fs-16' />
                                    </Link>
                                </div>
                                <div className="pt-4">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <Link href="#" className="fs-12 fw-medium text-muted text-truncate-1-line">{title}</Link>
                                        <div className="w-100 text-end">
                                            <span className="fs-12 text-dark">{progress_info}</span>{" "}
                                            <span className="fs-11 text-muted">({progress})</span>
                                        </div>
                                    </div>
                                    <div className="progress mt-2 ht-3">
                                        <div className={`progress-bar progress-${id}`} role="progressbar" style={{ width: progress }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            }
        </>
    )
}

export default SiteOverviewStatistics

