import React from 'react'
import PageHeader from '@/components/shared/pageHeader/PageHeader'
import Footer from '@/components/shared/Footer'
import { FiPlus, FiFilter, FiCheck, FiClock, FiAlertCircle } from 'react-icons/fi'

const tasksData = [
    { id: 1, title: 'Follow up with Jennifer Martinez', assignee: 'Pastor Mike', dueDate: 'Today', status: 'pending', priority: 'high' },
    { id: 2, title: 'Call David Kim about small groups', assignee: 'Sarah L.', dueDate: 'Tomorrow', status: 'pending', priority: 'medium' },
    { id: 3, title: 'Send welcome email to new visitors', assignee: 'John D.', dueDate: 'Jan 28', status: 'completed', priority: 'low' },
    { id: 4, title: 'Schedule meeting with volunteer team', assignee: 'Pastor Mike', dueDate: 'Jan 30', status: 'pending', priority: 'medium' },
    { id: 5, title: 'Prepare Sunday announcement slides', assignee: 'Sarah L.', dueDate: 'Jan 26', status: 'overdue', priority: 'high' },
    { id: 6, title: 'Review prayer request responses', assignee: 'John D.', dueDate: 'Jan 29', status: 'pending', priority: 'low' },
]

const TasksPage = () => {
    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="fs-16 fw-bold mb-0">Tasks</h2>
                        <nav aria-label="breadcrumb">
                            <ol className="breadcrumb mb-0">
                                <li className="breadcrumb-item"><a href="/home">Home</a></li>
                                <li className="breadcrumb-item"><a href="/engage/pipeline">Engage</a></li>
                                <li className="breadcrumb-item active" aria-current="page">Tasks</li>
                            </ol>
                        </nav>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm"><FiFilter size={14} className="me-1" /> Filter</button>
                        <button className="btn btn-primary btn-sm"><FiPlus size={14} className="me-1" /> Add Task</button>
                    </div>
                </div>
            </PageHeader>
            <div className='main-content'>
                <div className='row'>
                    <div className='col-12'>
                        <div className='card stretch stretch-full'>
                            <div className='card-body p-0'>
                                <div className='table-responsive'>
                                    <table className='table table-hover mb-0'>
                                        <thead>
                                            <tr>
                                                <th style={{width: '40px'}}></th>
                                                <th>Task</th>
                                                <th>Assignee</th>
                                                <th>Due Date</th>
                                                <th>Priority</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tasksData.map((task) => (
                                                <tr key={task.id} className={task.status === 'completed' ? 'text-muted' : ''}>
                                                    <td>
                                                        <input type="checkbox" className="form-check-input" defaultChecked={task.status === 'completed'} />
                                                    </td>
                                                    <td className={task.status === 'completed' ? 'text-decoration-line-through' : ''}>{task.title}</td>
                                                    <td>{task.assignee}</td>
                                                    <td>{task.dueDate}</td>
                                                    <td>
                                                        <span className={`badge bg-soft-${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'secondary'}`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {task.status === 'completed' && <span className='badge bg-soft-success text-success'><FiCheck size={12} className='me-1' />Completed</span>}
                                                        {task.status === 'pending' && <span className='badge bg-soft-info text-info'><FiClock size={12} className='me-1' />Pending</span>}
                                                        {task.status === 'overdue' && <span className='badge bg-soft-danger text-danger'><FiAlertCircle size={12} className='me-1' />Overdue</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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

export default TasksPage
