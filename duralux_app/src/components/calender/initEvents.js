function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().slice(0, 16); // Format as 'YYYY-MM-DDTHH:MM'
}

export const initEvents = [
    {
        id: '1',
        title: 'Office Meeting for design',
        start: addDays(new Date(), 1), // 1 day from now
        end: addDays(new Date(), 1.0417), // 1 hour later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Busy",
            dotColor: "#5485e4"
        },
        allDay: false,
        category: 'Office',
    },
    {
        id: '2',
        title: 'Family Dinner',
        start: addDays(new Date(), 2), // 2 days from now
        end: addDays(new Date(), 2.0833), // 2 hours later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Free",
            dotColor: "rgb(37, 184, 101)"
        },
        allDay: false,
        category: 'Family',
    },
    {
        id: '3',
        title: 'Travel',
        start: addDays(new Date(), 30), // 30 days from now
        end: addDays(new Date(), 30.0417), // 1 hour later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Busy",
            dotColor: "rgb(23, 162, 184)"
        },
        allDay: false,
        category: 'Travel',
    },
    {
        id: '4',
        title: 'Birthdays',
        start: addDays(new Date(), 13), // 13 days from now
        end: addDays(new Date(), 13.0417), // 1 hour later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Free",
            dotColor: "rgb(71, 94, 119)"
        },
        allDay: false,
        category: 'Birthdays',
    },
    {
        id: '5',
        title: 'Company',
        start: addDays(new Date(), 16), // 16 days from now
        end: addDays(new Date(), 18), // 2 days later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Busy",
            dotColor: "rgb(61, 199, 190)"
        },
        allDay: false,
        category: 'Company',
    },
    {
        id: '6',
        title: 'Holidays',
        start: addDays(new Date(), 19), // 19 days from now
        end: addDays(new Date(), 21), // 2 days later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Free",
            dotColor: "rgb(88, 86, 214)"
        },
        allDay: false,
        category: 'Holidays',
    },
    {
        id: '7',
        title: 'Private',
        start: addDays(new Date(), 21), // 21 days from now
        end: addDays(new Date(), 21.0417), // 1 hour later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Busy",
            dotColor: "rgb(228, 158, 61)"
        },
        allDay: false,
        category: 'Private',
    },
    {
        id: '8',
        title: 'Office Meeting',
        start: addDays(new Date(), 26), // 26 days from now
        end: addDays(new Date(), 27), // 1 day later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Busy",
            dotColor: "#5485e4"
        },
        allDay: true,
        category: 'Office',
    },
    {
        id: '9',
        title: 'Friend',
        start: addDays(new Date(), 15), // 15 days from now
        end: addDays(new Date(), 16), // 1 day later
        details: {
            details: "Lorem ipsum dolor sit, amet consectetur adipisicing elit. Odio qui ducimus quod quisquam ipsum. Itaque maxime quas vitae repudiandae aut corporis nam necessitatibus culpa soluta.",
            location: "Bangladesh",
            position: "Busy",
            dotColor: "rgb(209, 59, 76)"
        },
        allDay: true,
        category: 'Friend',
    },
];