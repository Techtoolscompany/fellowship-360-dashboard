'use client'
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import CardHeader from '@/components/shared/CardHeader'
import { FiPlus, FiCalendar, FiUser, FiUsers, FiCheckCircle, FiTarget, FiMoreVertical } from 'react-icons/fi'
import { useToast } from '@/components/shared/Toast'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const pipelineStats = [
    { title: 'Total in Pipeline', value: '38', icon: FiUsers, color: 'primary', detail: 'Active visitors' },
    { title: 'Connected This Week', value: '12', icon: FiCheckCircle, color: 'success', detail: '+25% vs last week' },
    { title: 'Avg. Days to Join', value: '21', icon: FiCalendar, color: 'info', detail: 'From first visit' },
    { title: 'Conversion Rate', value: '32%', icon: FiTarget, color: 'warning', detail: 'Visitor to member' },
]

const funnelData = {
    series: [{
        name: 'Visitors',
        data: [38, 26, 18, 12, 8]
    }],
    options: {
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%', distributed: true } },
        colors: ['#3b82f6', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6'],
        xaxis: { categories: ['New Visitor', 'Attempted Contact', 'Connected', 'Scheduled Visit', 'Joined'] },
        dataLabels: { enabled: true, formatter: (val) => val + ' visitors' },
        legend: { show: false },
        grid: { borderColor: '#f1f1f1' }
    }
}

const weeklyActivityData = {
    series: [{
        name: 'Calls Made',
        data: [12, 8, 15, 10, 18, 6, 14]
    }, {
        name: 'Connections',
        data: [4, 3, 6, 4, 8, 2, 5]
    }],
    options: {
        chart: { type: 'bar', toolbar: { show: false }, stacked: false },
        colors: ['#3b82f6', '#10b981'],
        plotOptions: { bar: { borderRadius: 2, columnWidth: '60%' } },
        xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        legend: { position: 'top' },
        grid: { borderColor: '#f1f1f1' }
    }
}

const initialColumns = {
    new: {
        id: 'new',
        title: 'New Visitor',
        color: 'info',
        items: [
            { id: 'card-1', name: 'Jennifer Martinez', lastContact: 'Today', owner: 'Pastor Mike', nextAction: 'Jan 28', priority: 'high' },
            { id: 'card-2', name: 'Carlos Rodriguez', lastContact: 'Yesterday', owner: 'Sarah L.', nextAction: 'Jan 29', priority: 'medium' },
            { id: 'card-9', name: 'Emily Watson', lastContact: '3 days ago', owner: 'John D.', nextAction: 'Jan 30', priority: 'low' },
        ]
    },
    attempted: {
        id: 'attempted',
        title: 'Attempted',
        color: 'warning',
        items: [
            { id: 'card-3', name: 'Amanda Chen', lastContact: '2 days ago', owner: 'Pastor Mike', nextAction: 'Jan 27', priority: 'high' },
            { id: 'card-10', name: 'Robert Kim', lastContact: '4 days ago', owner: 'Sarah L.', nextAction: 'Jan 28', priority: 'medium' },
        ]
    },
    connected: {
        id: 'connected',
        title: 'Connected',
        color: 'primary',
        items: [
            { id: 'card-4', name: 'David Kim', lastContact: '3 days ago', owner: 'John D.', nextAction: 'Jan 30', priority: 'medium' },
            { id: 'card-5', name: 'Lisa Thompson', lastContact: '1 week ago', owner: 'Sarah L.', nextAction: 'Jan 28', priority: 'low' },
        ]
    },
    scheduled: {
        id: 'scheduled',
        title: 'Scheduled Visit',
        color: 'secondary',
        items: [
            { id: 'card-6', name: 'Mark Wilson', lastContact: 'Today', owner: 'Pastor Mike', nextAction: 'Jan 26', priority: 'high' },
        ]
    },
    joined: {
        id: 'joined',
        title: 'Joined',
        color: 'success',
        items: [
            { id: 'card-7', name: 'Rachel Green', lastContact: '2 weeks ago', owner: 'John D.', nextAction: 'Feb 1', priority: 'low' },
        ]
    },
    inactive: {
        id: 'inactive',
        title: 'Inactive',
        color: 'danger',
        items: [
            { id: 'card-8', name: 'Tom Bradley', lastContact: '1 month ago', owner: 'Sarah L.', nextAction: 'Overdue', priority: 'high' },
        ]
    },
}

const PipelinePage = () => {
    const [columns, setColumns] = useState(initialColumns)
    const toast = useToast()

    const onDragEnd = (result) => {
        const { source, destination } = result

        if (!destination) return

        if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return
        }

        const sourceColumn = columns[source.droppableId]
        const destColumn = columns[destination.droppableId]
        const sourceItems = [...sourceColumn.items]
        const destItems = source.droppableId === destination.droppableId ? sourceItems : [...destColumn.items]

        const [removed] = sourceItems.splice(source.index, 1)

        if (source.droppableId === destination.droppableId) {
            sourceItems.splice(destination.index, 0, removed)
            setColumns({
                ...columns,
                [source.droppableId]: {
                    ...sourceColumn,
                    items: sourceItems,
                },
            })
        } else {
            destItems.splice(destination.index, 0, removed)
            setColumns({
                ...columns,
                [source.droppableId]: {
                    ...sourceColumn,
                    items: sourceItems,
                },
                [destination.droppableId]: {
                    ...destColumn,
                    items: destItems,
                },
            })
            toast.success(`Moved ${removed.name} to ${destColumn.title}`)
        }
    }

    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Visitor Pipeline</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/engage/pipeline">Engage</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Pipeline</li>
                            </ol>
                        </nav>
                    </div>
                    <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Visitor</button>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row mb-4'>
                    {pipelineStats.map((stat, index) => (
                        <div key={index} className='col-xl-3 col-md-6'>
                            <div className='card stretch stretch-full'>
                                <div className='card-body'>
                                    <div className='d-flex align-items-center justify-content-between'>
                                        <div>
                                            <p className='text-muted fs-12 mb-1'>{stat.title}</p>
                                            <h3 className='fw-bold mb-1'>{stat.value}</h3>
                                            <span className='text-muted fs-11'>{stat.detail}</span>
                                        </div>
                                        <div className={`wd-50 ht-50 bg-soft-${stat.color} text-${stat.color} rounded-circle d-flex align-items-center justify-content-center`}>
                                            <stat.icon size={24} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className='row mb-4'>
                    <div className='col-xxl-6'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Pipeline Funnel" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={funnelData.options}
                                    series={funnelData.series}
                                    type="bar"
                                    height={250}
                                />
                            </div>
                        </div>
                    </div>
                    <div className='col-xxl-6'>
                        <div className='card stretch stretch-full'>
                            <CardHeader title="Weekly Follow-up Activity" />
                            <div className='card-body'>
                                <ReactApexChart
                                    options={weeklyActivityData.options}
                                    series={weeklyActivityData.series}
                                    type="bar"
                                    height={250}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className='card mb-4'>
                    <div className='card-header d-flex align-items-center justify-content-between'>
                        <h5 className='card-title mb-0'>Pipeline Board</h5>
                        <span className='text-muted fs-11'>Drag and drop cards to move visitors between stages</span>
                    </div>
                    <div className='card-body' style={{ overflowX: 'auto' }}>
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className='d-flex gap-3' style={{ minWidth: 'max-content' }}>
                                {Object.entries(columns).map(([columnId, column]) => (
                                    <div key={columnId} style={{ minWidth: '260px', width: '260px' }}>
                                        <div className={`rounded-top p-2 bg-soft-${column.color} text-center`}>
                                            <span className='fw-bold fs-13'>{column.title}</span>
                                            <span className={`badge bg-${column.color} ms-2`}>{column.items.length}</span>
                                        </div>
                                        <Droppable droppableId={columnId}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className='border border-top-0 rounded-bottom p-2'
                                                    style={{ 
                                                        minHeight: '400px', 
                                                        backgroundColor: snapshot.isDraggingOver ? '#e0e7ff' : '#fafafa',
                                                        transition: 'background-color 0.2s ease',
                                                    }}
                                                >
                                                    {column.items.map((card, index) => (
                                                        <Draggable key={card.id} draggableId={card.id} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    className='card mb-2 kanban-card'
                                                                    style={{
                                                                        ...provided.draggableProps.style,
                                                                        boxShadow: snapshot.isDragging 
                                                                            ? '0 8px 25px rgba(0, 0, 0, 0.15)' 
                                                                            : '0 1px 3px rgba(0, 0, 0, 0.08)',
                                                                        transform: snapshot.isDragging 
                                                                            ? `${provided.draggableProps.style?.transform} rotate(3deg)` 
                                                                            : provided.draggableProps.style?.transform,
                                                                    }}
                                                                >
                                                                    <div className='card-body p-3'>
                                                                        <div className='d-flex justify-content-between align-items-start mb-2'>
                                                                            <h6 className='fs-13 fw-semibold mb-0'>{card.name}</h6>
                                                                            <span className={`badge bg-soft-${card.priority === 'high' ? 'danger' : card.priority === 'medium' ? 'warning' : 'success'} text-${card.priority === 'high' ? 'danger' : card.priority === 'medium' ? 'warning' : 'success'}`} style={{ fontSize: '9px' }}>
                                                                                {card.priority}
                                                                            </span>
                                                                        </div>
                                                                        <p className='text-muted fs-11 mb-2'>Last contact: {card.lastContact}</p>
                                                                        <div className='d-flex justify-content-between align-items-center'>
                                                                            <span className='fs-11 text-muted'>
                                                                                <FiUser size={10} className='me-1' />{card.owner}
                                                                            </span>
                                                                            <span className={`fs-11 ${card.nextAction === 'Overdue' ? 'text-danger fw-bold' : 'text-muted'}`}>
                                                                                <FiCalendar size={10} className='me-1' />{card.nextAction}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                ))}
                            </div>
                        </DragDropContext>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    )
}

export default PipelinePage