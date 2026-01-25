'use client'
import React from 'react'

const Skeleton = ({ 
    width = '100%', 
    height = '20px', 
    borderRadius = '4px',
    className = '',
    variant = 'default'
}) => {
    const baseStyle = {
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
    }

    return (
        <>
            <style jsx>{`
                @keyframes skeleton-shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
            <div className={`skeleton ${className}`} style={baseStyle} />
        </>
    )
}

export const SkeletonCard = ({ showHeader = true, rows = 3 }) => {
    return (
        <div className="card stretch stretch-full">
            {showHeader && (
                <div className="card-header d-flex align-items-center justify-content-between">
                    <Skeleton width="40%" height="20px" />
                    <Skeleton width="24px" height="24px" borderRadius="50%" />
                </div>
            )}
            <div className="card-body">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="mb-3">
                        <Skeleton width={`${80 - (i * 10)}%`} height="16px" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export const SkeletonKPI = () => {
    return (
        <div className="card stretch stretch-full">
            <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                    <div style={{ flex: 1 }}>
                        <Skeleton width="60%" height="12px" className="mb-2" />
                        <Skeleton width="80%" height="28px" className="mb-2" />
                        <Skeleton width="40%" height="14px" />
                    </div>
                    <Skeleton width="50px" height="50px" borderRadius="50%" />
                </div>
            </div>
        </div>
    )
}

export const SkeletonTable = ({ rows = 5, columns = 4 }) => {
    return (
        <div className="card stretch stretch-full">
            <div className="card-header">
                <Skeleton width="30%" height="20px" />
            </div>
            <div className="card-body p-0">
                <div className="table-responsive">
                    <table className="table table-hover mb-0">
                        <thead>
                            <tr>
                                {Array.from({ length: columns }).map((_, i) => (
                                    <th key={i}>
                                        <Skeleton width="80%" height="16px" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: rows }).map((_, rowIndex) => (
                                <tr key={rowIndex}>
                                    {Array.from({ length: columns }).map((_, colIndex) => (
                                        <td key={colIndex}>
                                            <Skeleton width={`${70 + Math.random() * 30}%`} height="14px" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export const SkeletonChart = ({ height = 300 }) => {
    return (
        <div className="card stretch stretch-full">
            <div className="card-header">
                <Skeleton width="35%" height="20px" />
            </div>
            <div className="card-body d-flex align-items-center justify-content-center">
                <Skeleton width="100%" height={`${height}px`} borderRadius="8px" />
            </div>
        </div>
    )
}

export const SkeletonAvatar = ({ size = 40 }) => {
    return <Skeleton width={`${size}px`} height={`${size}px`} borderRadius="50%" />
}

export const SkeletonText = ({ lines = 3, widths = [] }) => {
    const defaultWidths = ['100%', '90%', '75%', '85%', '60%']
    return (
        <div>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton 
                    key={i} 
                    width={widths[i] || defaultWidths[i % defaultWidths.length]} 
                    height="14px" 
                    className="mb-2" 
                />
            ))}
        </div>
    )
}

export default Skeleton