import Link from "next/link";
import React from "react";
import {
  FiAtSign,
  FiBell,
  FiCalendar,
  FiLifeBuoy,
  FiMoreVertical,
  FiSettings,
  FiTrash,
} from "react-icons/fi";


const CardHeader = ({ title, refresh, remove, expanded }) => {
  return (
    <div className="card-header">
      <h5 className="card-title">{title}</h5>
      <div className="card-header-action">
        <div className="card-header-btn">
          <div data-toggle="tooltip" data-title="Delete" onClick={remove}>
            <span
              className="avatar-text avatar-xs bg-danger"
              data-bs-toggle="remove"
            >
              {" "}
            </span>
          </div>
          <div data-toggle="tooltip" data-title="Refresh" onClick={refresh}>
            <span
              className="avatar-text avatar-xs bg-warning"
              data-bs-toggle="refresh"
            >
              {" "}
            </span>
          </div>
          <div data-toggle="tooltip" data-title="Maximize/Minimize" onClick={expanded}>
            <span
              className="avatar-text avatar-xs bg-success"
              data-bs-toggle="expand"
            >
              {" "}
            </span>
          </div>
        </div>
        <div className="filter-dropdown">
          <div
            className="avatar-text avatar-sm"
            data-bs-toggle="dropdown"
            data-bs-offset="25, 25"
          >
            <div data-toggle="tooltip" data-title="Options" className="lh-1">
              <FiMoreVertical />
            </div>
          </div>
          <div className="dropdown-menu dropdown-menu-end">
            <Link href="#" className="dropdown-item">
              <i>
                <FiAtSign />
              </i>
              New
            </Link>
            <Link href="#" className="dropdown-item">
              <i>
                <FiCalendar />
              </i>
              Event
            </Link>
            <Link href="#" className="dropdown-item">
              <i>
                <FiBell />
              </i>
              Snoozed
            </Link>
            <Link href="#" className="dropdown-item">
              <i>
                <FiTrash />
              </i>
              Deleted
            </Link>
            <div className="dropdown-divider"></div>
            <Link href="#" className="dropdown-item">
              <i>
                <FiSettings />
              </i>
              Settings
            </Link>
            <Link href="#" className="dropdown-item">
              <i>
                <FiLifeBuoy />
              </i>
              Tips & Tricks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardHeader;
