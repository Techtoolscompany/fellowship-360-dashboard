export const menuList = [
    {
        id: 0,
        name: "Home",
        path: "/home",
        icon: 'feather-home',
        dropdownMenu: [
            {
                id: 1,
                name: "Dashboard",
                path: "/home",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 1,
        name: "People",
        path: "#",
        icon: 'feather-users',
        dropdownMenu: [
            {
                id: 1,
                name: "Contacts",
                path: "/people/contacts",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Segments",
                path: "/people/segments",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 2,
        name: "Engage",
        path: '#',
        icon: 'feather-target',
        dropdownMenu: [
            {
                id: 1,
                name: "Pipeline",
                path: "/engage/pipeline",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Tasks",
                path: "/engage/tasks",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 3,
        name: "Comms",
        path: "#",
        icon: 'feather-message-circle',
        dropdownMenu: [
            {
                id: 1,
                name: "Conversations",
                path: "/comms/conversations",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Broadcasts",
                path: "/comms/broadcasts",
                subdropdownMenu: false
            },
            {
                id: 3,
                name: "Templates",
                path: "/comms/templates",
                subdropdownMenu: false
            }
        ],
    },
    {
        id: 4,
        name: "Grace AI",
        path: "#",
        icon: 'feather-phone',
        dropdownMenu: [
            {
                id: 1,
                name: "Calls",
                path: "/grace/calls",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Settings",
                path: "/grace/settings",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 5,
        name: "Prayer & Care",
        path: "#",
        icon: 'feather-heart',
        dropdownMenu: [
            {
                id: 1,
                name: "Prayer Requests",
                path: "/care/prayer-requests",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 6,
        name: "Scheduling",
        path: "#",
        icon: 'feather-calendar',
        dropdownMenu: [
            {
                id: 1,
                name: "Calendar",
                path: "/scheduling/calendar",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Appointments",
                path: "/scheduling/appointments",
                subdropdownMenu: false
            },
            {
                id: 3,
                name: "Volunteers",
                path: "/scheduling/volunteers",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 7,
        name: "Giving",
        path: "#",
        icon: 'feather-dollar-sign',
        dropdownMenu: [
            {
                id: 1,
                name: "Donations",
                path: "/giving/donations",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Donors",
                path: "/giving/donors",
                subdropdownMenu: false
            },
            {
                id: 3,
                name: "Pledges",
                path: "/giving/pledges",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 8,
        name: "Reports",
        path: "#",
        icon: 'feather-bar-chart-2',
        dropdownMenu: [
            {
                id: 1,
                name: "Overview",
                path: "/reports/overview",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Attendance",
                path: "/reports/attendance",
                subdropdownMenu: false
            },
            {
                id: 3,
                name: "Engagement",
                path: "/reports/engagement",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 9,
        name: "Settings",
        path: "#",
        icon: 'feather-settings',
        dropdownMenu: [
            {
                id: 1,
                name: "Church Profile",
                path: "/settings/church-profile",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Users & Roles",
                path: "/settings/users-roles",
                subdropdownMenu: false
            },
            {
                id: 3,
                name: "Integrations",
                path: "/settings/integrations",
                subdropdownMenu: false
            },
            {
                id: 4,
                name: "Billing",
                path: "/settings/billing",
                subdropdownMenu: false
            }
        ]
    },
    {
        id: 10,
        name: "Admin",
        path: "#",
        icon: 'feather-shield',
        dropdownMenu: [
            {
                id: 1,
                name: "Churches",
                path: "/admin/churches",
                subdropdownMenu: false
            },
            {
                id: 2,
                name: "Provisioning",
                path: "/admin/provisioning",
                subdropdownMenu: false
            }
        ]
    }
]

export const menuSections = [
    {
        title: 'Main',
        items: ['Home', 'People', 'Engage']
    },
    {
        title: 'Communication',
        items: ['Comms', 'Grace AI', 'Prayer & Care']
    },
    {
        title: 'Operations',
        items: ['Scheduling', 'Giving', 'Reports']
    },
    {
        title: 'Administration',
        items: ['Settings', 'Admin']
    }
]