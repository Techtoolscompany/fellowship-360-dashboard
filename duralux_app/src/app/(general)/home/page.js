'use client'
import React from 'react'
import Link from 'next/link'
import { FiSearch, FiMic, FiEye, FiCalendar, FiArrowRight, FiFilter, FiMoreVertical, FiArrowUpRight, FiArrowDownRight, FiCheck, FiClock } from 'react-icons/fi'

const HomePage = () => {
    return (
        <div style={{ 
            display: 'flex', 
            minHeight: '100vh',
            background: '#ffffff',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
            <div style={{ 
                flex: 1, 
                padding: '33px 24px 24px 24px',
                marginLeft: '96px',
            }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '403px', flex: 1 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flex: 1,
                                    border: '1px solid rgba(0,0,0,0.2)',
                                    borderRadius: '360px',
                                    padding: '8px 12px',
                                }}>
                                    <div style={{
                                        background: '#f0f1f5',
                                        borderRadius: '360px',
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <FiSearch size={20} color="#343330" />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Type to search"
                                        style={{
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            fontSize: '12px',
                                            color: '#343330',
                                            flex: 1,
                                        }}
                                    />
                                </div>
                                <button style={{
                                    border: '1px solid rgba(0,0,0,0.2)',
                                    borderRadius: '360px',
                                    padding: '12px',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <FiMic size={20} color="#343330" />
                                </button>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                border: '1px solid #d6d6d6',
                                borderRadius: '360px',
                                padding: '4px 20px 4px 8px',
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                }}></div>
                                <span style={{ fontSize: '16px', fontWeight: 500, color: '#343330' }}>Hello, Admin</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <p style={{ fontSize: '24px', color: '#969696', marginBottom: '8px', lineHeight: 1.5 }}>
                                Track Your Inflows and Outflows with Precision
                            </p>
                            <h1 style={{ fontSize: '48px', fontWeight: 600, color: '#343330', margin: 0, lineHeight: 1.5 }}>
                                Cash Flow Dashboard
                            </h1>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '32px',
                            borderTop: '1px solid #bfbfbf',
                            borderBottom: '1px solid #bfbfbf',
                            marginBottom: '24px',
                        }}>
                            <div style={{ padding: '24px 0' }}>
                                <p style={{ fontSize: '16px', fontWeight: 600, color: '#343330', marginBottom: '8px' }}>Total Balance</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', color: '#343330' }}>**** **** **** 2598</span>
                                    <button style={{
                                        background: '#f0f1f5',
                                        border: 'none',
                                        borderRadius: '360px',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}>
                                        <FiEye size={20} color="#343330" />
                                    </button>
                                </div>
                            </div>
                            <div style={{ width: '1px', background: '#bfbfbf', margin: '24px 0' }}></div>
                            <div style={{ padding: '24px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '6px',
                                        background: '#bbff00',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <FiArrowDownRight size={18} color="#343330" />
                                    </div>
                                    <span style={{ fontSize: '16px', color: '#636363' }}>Inflows</span>
                                </div>
                                <p style={{ fontSize: '32px', fontWeight: 600, color: '#343330', margin: 0 }}>$ 11,342,882</p>
                            </div>
                            <div style={{ width: '1px', background: '#bfbfbf', margin: '24px 0' }}></div>
                            <div style={{ padding: '24px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '6px',
                                        background: '#bbff00',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <FiArrowUpRight size={18} color="#343330" />
                                    </div>
                                    <span style={{ fontSize: '16px', color: '#636363' }}>Outflows</span>
                                </div>
                                <p style={{ fontSize: '32px', fontWeight: 600, color: '#343330', margin: 0 }}>$ 6,258,444</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                            <div style={{
                                flex: 1,
                                background: '#f2f2f2',
                                border: '1px solid #e9e9e9',
                                borderRadius: '24px',
                                padding: '23px',
                                minHeight: '334px',
                                position: 'relative',
                            }}>
                                <p style={{ fontSize: '20px', fontWeight: 600, color: '#343330', marginBottom: '16px' }}>Net Worth</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                    {[
                                        { color: '#d9d9d9', label: 'Marketing Expenses' },
                                        { color: '#bbff00', label: 'Rent Fees' },
                                        { color: '#ffe500', label: 'Income' },
                                        { color: '#ffd966', label: 'Payroll' },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }}></div>
                                            <span style={{ fontSize: '12px', color: '#343330', opacity: 0.6 }}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    right: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '180px',
                                    height: '180px',
                                    borderRadius: '50%',
                                    background: 'conic-gradient(#d9d9d9 0deg 72deg, #bbff00 72deg 144deg, #ffe500 144deg 216deg, #ffd966 216deg 288deg, #f2f2f2 288deg 360deg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <div style={{
                                        width: '120px',
                                        height: '120px',
                                        borderRadius: '50%',
                                        background: '#f2f2f2',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <span style={{ fontSize: '11px', color: '#343330' }}>Total cash spent</span>
                                        <span style={{ fontSize: '18px', fontWeight: 600, color: '#343330' }}>$ 6,258,444</span>
                                    </div>
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '23px',
                                    left: '23px',
                                    background: '#bbff00',
                                    borderRadius: '360px',
                                    padding: '2px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}>
                                    <span style={{ fontSize: '12px', color: '#000329' }}>Increased by 12%</span>
                                    <FiArrowUpRight size={16} color="#000329" />
                                </div>
                            </div>

                            <div style={{
                                width: '535px',
                                background: '#f2f2f2',
                                border: '1px solid #e9e9e9',
                                borderRadius: '24px',
                                padding: '15px 23px 23px',
                                minHeight: '334px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <p style={{ fontSize: '20px', fontWeight: 600, color: 'black', marginBottom: '8px' }}>Trends And Insights</p>
                                        <p style={{ fontSize: '12px', color: 'black', opacity: 0.6 }}>Your marketing expenses increased by 20% this month.</p>
                                    </div>
                                    <div style={{
                                        background: '#bbff00',
                                        borderRadius: '360px',
                                        padding: '4px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                    }}>
                                        <span style={{ fontSize: '14px', color: '#000329' }}>Week</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingBottom: '24px' }}>
                                    {[
                                        { day: 'Mon', h1: 70, h2: 16 },
                                        { day: 'Tue', h1: 78, h2: 16 },
                                        { day: 'Wed', h1: 106, h2: 16 },
                                        { day: 'Thur', h1: 128, h2: 16, active: true },
                                        { day: 'Fri', h1: 101, h2: 16 },
                                        { day: 'Sat', h1: 114, h2: 16 },
                                        { day: 'Sun', h1: 125, h2: 16 },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '16px',
                                                    height: `${item.h1}px`,
                                                    borderRadius: '16px',
                                                    background: item.active ? '#bbff00' : (i < 3 ? '#343330' : '#b2b2b2'),
                                                }}></div>
                                                <div style={{
                                                    width: '16px',
                                                    height: `${item.h2}px`,
                                                    borderRadius: '16px',
                                                    background: item.active ? '#bbff00' : (i < 3 ? '#343330' : '#b2b2b2'),
                                                }}></div>
                                            </div>
                                            <span style={{ fontSize: '16px', color: '#343330' }}>{item.day}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{
                                flex: 1,
                                background: '#f4ffd4',
                                border: '1px solid #e9e9e9',
                                borderRadius: '24px',
                                padding: '35px 23px',
                                minHeight: '334px',
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                                        {[1,2,3,4,5].map((_, i) => (
                                            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#343330' }}></div>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '28px', fontWeight: 600, color: '#343330', lineHeight: 1.3 }}>
                                        Unlock the power of your finances with our Cash Flow Dashboard!
                                    </p>
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-50px',
                                    right: '-50px',
                                    width: '284px',
                                    height: '284px',
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(187,255,0,0.5) 0%, rgba(187,255,0,0.2) 50%, transparent 70%)',
                                }}></div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{
                                width: '250px',
                                background: '#343330',
                                borderRadius: '24px',
                                padding: '16px',
                                color: 'white',
                            }}>
                                <p style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Debt status</p>
                                <p style={{ fontSize: '16px', marginBottom: '32px' }}>In progress</p>
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', paddingRight: '20px', marginBottom: '16px' }}>
                                        <div style={{ width: '157px', height: '19px', borderRadius: '360px', background: '#bbff00', marginRight: '-20px', zIndex: 2 }}></div>
                                        <div style={{ flex: 1, height: '19px', borderRadius: '360px', background: '#d9d9d9', marginRight: '-20px', zIndex: 1 }}></div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>Estimated processing</p>
                                        <p style={{ fontSize: '16px' }}>4-5 business days</p>
                                    </div>
                                </div>
                                <button style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    background: 'white',
                                    border: 'none',
                                    borderRadius: '360px',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: '#343330',
                                    cursor: 'pointer',
                                }}>
                                    View Analytics
                                </button>
                            </div>

                            <div style={{
                                width: '561px',
                                background: '#f2f2f2',
                                border: '1px solid #e9e9e9',
                                borderRadius: '24px',
                                padding: '23px',
                                position: 'relative',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '20px', fontWeight: 600, color: '#343330' }}>Net Worth</p>
                                    <div style={{
                                        background: '#bbff00',
                                        borderRadius: '360px',
                                        padding: '4px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                    }}>
                                        <FiArrowUpRight size={16} color="#000329" />
                                        <span style={{ fontSize: '16px', fontWeight: 500, color: '#000329' }}>50%</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', fontSize: '12px', color: '#343330', opacity: 0.7, position: 'absolute', left: '23px', top: '63px' }}>
                                    <span>20k</span>
                                    <span>15k</span>
                                    <span>10k</span>
                                    <span>0</span>
                                </div>
                                <div style={{ 
                                    height: '150px', 
                                    marginLeft: '40px',
                                    background: 'linear-gradient(180deg, rgba(187,255,0,0.1) 0%, transparent 100%)',
                                    borderRadius: '8px',
                                    position: 'relative',
                                }}>
                                    <svg width="100%" height="100%" viewBox="0 0 500 150" preserveAspectRatio="none">
                                        <path d="M 0 120 Q 50 100, 100 80 T 200 60 T 300 90 T 400 50 T 500 70" 
                                            fill="none" stroke="#bbff00" strokeWidth="2" />
                                        <path d="M 0 100 Q 50 110, 100 90 T 200 100 T 300 80 T 400 95 T 500 85" 
                                            fill="none" stroke="#343330" strokeWidth="2" />
                                    </svg>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: '40px', marginTop: '8px', fontSize: '12px', color: '#343330', opacity: 0.7 }}>
                                    <span>Feb 14</span>
                                    <span>Feb 16</span>
                                    <span>Feb 18</span>
                                    <span>Feb 20</span>
                                </div>
                            </div>

                            <div style={{
                                flex: 1,
                                background: '#f2f2f2',
                                border: '1px solid #e9e9e9',
                                borderRadius: '24px',
                                padding: '15px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <p style={{ fontSize: '20px', fontWeight: 600, color: '#343330' }}>Transaction History</p>
                                    <button style={{
                                        background: 'white',
                                        border: 'none',
                                        borderRadius: '360px',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}>
                                        <FiMoreVertical size={20} color="#343330" />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', fontSize: '12px', color: '#343330', opacity: 0.7, marginBottom: '8px' }}>
                                    <span style={{ width: '70px' }}>DATE & TIME</span>
                                    <span style={{ width: '70px' }}>AMOUNT</span>
                                    <span style={{ width: '86px', textAlign: 'center' }}>STATUS</span>
                                </div>
                                {[
                                    { date: '13/1/2024', amount: '$12,432', status: 'Pending', statusColor: '#fd4a4a', statusBg: '#ffdbdb' },
                                    { date: '12/1/2024', amount: '$184', status: 'Done', statusColor: '#19cf56', statusBg: '#c5f4d4' },
                                    { date: '10/1/2024', amount: '$235', status: 'Pending', statusColor: '#fd4a4a', statusBg: '#ffdbdb' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
                                        <span style={{ fontSize: '12px', color: '#343330', width: '70px' }}>{item.date}</span>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#343330', width: '70px' }}>{item.amount}</span>
                                        <div style={{
                                            background: item.statusBg,
                                            borderRadius: '360px',
                                            padding: '4px 8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }}>
                                            {item.status === 'Done' ? <FiCheck size={16} color={item.statusColor} /> : <FiClock size={16} color={item.statusColor} />}
                                            <span style={{ fontSize: '12px', color: item.statusColor }}>{item.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ width: '327px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'flex-end' }}>
                            <div style={{
                                background: '#f0f1f5',
                                borderRadius: '360px',
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}>
                                <div style={{
                                    background: 'white',
                                    borderRadius: '360px',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    <FiCalendar size={20} color="#343330" />
                                </div>
                                <span style={{ fontSize: '12px', color: '#343330' }}>01/01/2025 - 05/01/2025</span>
                            </div>
                            <div style={{
                                background: '#2c2d32',
                                borderRadius: '360px',
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}>
                                <span style={{ fontSize: '12px', color: 'white' }}>Weekly</span>
                                <div style={{
                                    background: 'white',
                                    borderRadius: '360px',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    <FiArrowRight size={20} color="#343330" />
                                </div>
                            </div>
                            <button style={{
                                border: '1px solid #bfbfbf',
                                borderRadius: '360px',
                                padding: '6px',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                            }}>
                                <FiFilter size={20} color="#343330" />
                            </button>
                        </div>

                        <div style={{
                            background: '#f2f2f2',
                            border: '1px solid #e9e9e9',
                            borderRadius: '24px',
                            padding: '15px',
                            height: '182px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <p style={{ fontSize: '20px', fontWeight: 600, color: '#343330', marginBottom: '16px' }}>This month</p>
                            <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                                <div style={{ background: '#d6ff65', borderRadius: '8px', width: '60px', height: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '8px' }}>
                                    <div style={{ background: 'white', borderRadius: '8px', padding: '8px' }}>
                                        <span style={{ fontSize: '10px', color: '#343330', opacity: 0.4, display: 'block' }}>total income</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#343330' }}>$ 11,342,882</span>
                                    </div>
                                </div>
                                <div style={{ background: '#d9d9d9', borderRadius: '8px', width: '60px', height: '90px', marginTop: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '8px' }}>
                                    <div style={{ background: 'white', borderRadius: '8px', padding: '8px' }}>
                                        <span style={{ fontSize: '10px', color: '#343330', opacity: 0.4, display: 'block' }}>expenses</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#343330' }}>$ 6,258,444</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HomePage
