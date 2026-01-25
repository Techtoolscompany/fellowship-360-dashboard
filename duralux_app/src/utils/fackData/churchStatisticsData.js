export const churchStatisticsData = [
    {
        id: 1,
        title: "Total Members",
        total_number: "1,247",
        completed_number: "",
        progress: "78%",
        progress_info: "+12% this month",
        icon: "feather-users"
    },
    {
        id: 2,
        title: "New Visitors",
        total_number: "38",
        completed_number: "12",
        progress: "32%",
        progress_info: "12 Connected",
        icon: "feather-user-plus"
    },
    {
        id: 3,
        title: "Grace AI Calls",
        total_number: "156",
        completed_number: "134",
        progress: "86%",
        progress_info: "134 Completed",
        icon: "feather-phone"
    },
    {
        id: 4,
        title: "Weekly Giving",
        total_number: "$12,450",
        completed_number: "",
        progress: "65%",
        progress_info: "+15% vs last week",
        icon: "feather-dollar-sign"
    }
]

export const upcomingEventsData = [
    {
        id: 1,
        schedule_name: "Sunday Worship Service",
        date: { day: "28", month: "Jan", time: "9:00 AM - 11:30 AM" },
        team_members: [1, 2, 3],
        color: "primary"
    },
    {
        id: 2,
        schedule_name: "Youth Group Meeting",
        date: { day: "29", month: "Jan", time: "6:30 PM - 8:00 PM" },
        team_members: [4, 5],
        color: "success"
    },
    {
        id: 3,
        schedule_name: "Prayer & Worship Night",
        date: { day: "31", month: "Jan", time: "7:00 PM - 9:00 PM" },
        team_members: [1, 6, 7],
        color: "warning"
    },
    {
        id: 4,
        schedule_name: "Men's Bible Study",
        date: { day: "01", month: "Feb", time: "7:00 AM - 8:00 AM" },
        team_members: [2, 8],
        color: "info"
    }
]

export const recentActivityData = [
    { id: 1, type: 'visitor', message: 'Sarah Johnson registered as a new visitor', time: '2 hours ago', color: 'primary' },
    { id: 2, type: 'call', message: 'Grace AI completed follow-up call with Mike Davis', time: '3 hours ago', color: 'success' },
    { id: 3, type: 'prayer', message: 'New prayer request submitted by Emily White', time: '4 hours ago', color: 'warning' },
    { id: 4, type: 'donation', message: 'Online donation received from Robert Brown - $250', time: '5 hours ago', color: 'info' },
    { id: 5, type: 'event', message: 'Youth Group meeting scheduled for Saturday', time: '6 hours ago', color: 'secondary' },
]

export const visitorPipelineData = [
    { stage: "New Visitor", count: 12, percentage: 32, color: "primary" },
    { stage: "Attempted Contact", count: 8, percentage: 21, color: "info" },
    { stage: "Connected", count: 6, percentage: 16, color: "warning" },
    { stage: "Scheduled Visit", count: 5, percentage: 13, color: "success" },
    { stage: "Joined", count: 4, percentage: 11, color: "dark" },
    { stage: "Inactive", count: 3, percentage: 8, color: "secondary" }
]

export const topDonorsData = [
    { id: 1, name: "Robert & Mary Johnson", amount: "$2,450", ytd: "$12,500", status: "active" },
    { id: 2, name: "David Smith", amount: "$1,850", ytd: "$9,200", status: "active" },
    { id: 3, name: "Jennifer Williams", amount: "$1,200", ytd: "$7,800", status: "active" },
    { id: 4, name: "Michael & Susan Brown", amount: "$950", ytd: "$6,450", status: "active" },
    { id: 5, name: "Anonymous", amount: "$800", ytd: "$4,200", status: "active" }
]

export const prayerRequestsData = [
    { id: 1, name: "Emily White", request: "Healing for family member", status: "active", date: "Today" },
    { id: 2, name: "John Peters", request: "Job interview guidance", status: "active", date: "Yesterday" },
    { id: 3, name: "Maria Garcia", request: "Safe travel for mission trip", status: "answered", date: "2 days ago" },
    { id: 4, name: "Anonymous", request: "Financial provision", status: "active", date: "3 days ago" }
]
