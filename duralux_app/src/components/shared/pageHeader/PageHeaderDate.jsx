'use client'
import React, { useState } from 'react'
import { FiFilter, FiPlus } from 'react-icons/fi'
import Checkbox from '@/components/shared/Checkbox';
import DateRange from '../DateRange';
import Link from 'next/link';

const filterItems = ["Role", "Team", "Email", "Member", "Recommendation"]


const PageHeaderDate = () => {
  const [toggleDateRange, setToggleDateRange] = useState(false)

  return (
    <>
      <div className="d-flex align-items-center gap-2 page-header-right-items-wrapper">
        <div className="position-relative date-picker-field" onClick={() => setToggleDateRange(!toggleDateRange)}>
          <DateRange toggleDateRange={toggleDateRange} setToggleDateRange={setToggleDateRange} />
        </div>
        <div className="filter-dropdown">
          <Link href={"#"} className="btn btn-md btn-light-brand" data-bs-toggle="dropdown" data-bs-offset="0, 10" data-bs-auto-close="outside">
            <i className="me-2"><FiFilter /></i>
            <span>Filter</span>
          </Link>
          <div className="dropdown-menu dropdown-menu-end">
            {filterItems.map((name, index) =>
              <div key={index} className="dropdown-item">
                <Checkbox name={name} id={index} checked={name} />
              </div>
            )}

            <div className="dropdown-divider"></div>
            <Link href="#" className="dropdown-item">
              <FiPlus size={16} className="me-3" />
              <span>Create New</span>
            </Link>
            <Link href="#" className="dropdown-item">
              <FiFilter size={16} className="me-3" />
              <span>Manage Filter</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export default PageHeaderDate