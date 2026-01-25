'use client'
import React from 'react'
import { FiDownload } from 'react-icons/fi'

export const exportToCSV = (data, filename = 'export') => {
    if (!data || data.length === 0) {
        console.warn('No data to export')
        return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                let cell = row[header]
                if (cell === null || cell === undefined) {
                    cell = ''
                }
                cell = String(cell).replace(/"/g, '""')
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell}"`
                }
                return cell
            }).join(',')
        )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

const CsvExportButton = ({ 
    data, 
    filename = 'export', 
    label = 'Export CSV',
    className = 'btn btn-sm btn-outline-secondary',
    onExport = null
}) => {
    const handleExport = () => {
        exportToCSV(data, filename)
        if (onExport) onExport()
    }

    return (
        <button 
            className={className}
            onClick={handleExport}
            disabled={!data || data.length === 0}
        >
            <FiDownload size={14} className="me-1" />
            {label}
        </button>
    )
}

export default CsvExportButton