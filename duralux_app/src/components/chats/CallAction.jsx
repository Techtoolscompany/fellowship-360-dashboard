import React, { useState } from 'react'
import { FiMicOff, FiPause, FiPhoneCall, FiPhoneOff, FiPlus, FiVideo, FiVideoOff, FiX } from 'react-icons/fi'

const CallAction = ({ isVideoCall }) => {
    const [callEnd, setCallEnd] = useState(false)
    return (
        <div className="gap-2 d-flex align-items-center justify-content-center calling-receiver-action">
            <a href="#" className="btn btn-icon bg-white rounded-circle rounded-circle" data-toggle="tooltip" data-bs-trigger="hover" data-title="Mute Call">
                <FiMicOff size={16} strokeWidth={1.8} />
            </a>
            <a href="#" data-toggle="tooltip" data-bs-trigger="hover" data-title={`${isVideoCall ? "Switch Voice" : "Switch Video"}`}>
                {
                    isVideoCall ?
                        <span className="btn btn-icon bg-white rounded-circle rounded-circle" data-bs-target="#voiceCallingModalScreen" data-bs-toggle="modal" data-bs-dismiss="modal">
                            <FiVideoOff size={16} strokeWidth={1.8} />
                        </span>
                        :
                        <span className="btn btn-icon bg-white rounded-circle rounded-circle" data-bs-target="#videoCallingModalScreen" data-bs-toggle="modal" data-bs-dismiss="modal">
                            <FiVideo size={16} strokeWidth={1.8} />
                        </span>
                }
            </a>
            <a onClick={() => setCallEnd(true)} href="#" className="call-received btn btn-icon btn-success rounded-circle" data-toggle="tooltip" data-bs-trigger="hover" data-title="Received Call" style={{ display: callEnd ? "none" : "block" }}>
                <FiPhoneCall size={16} strokeWidth={1.8} />
            </a>
            <a href="#" className="btn btn-icon btn-danger rounded-circle call-ended" data-toggle="tooltip" data-bs-trigger="hover" data-title="End Call" data-bs-dismiss="modal" style={{ display: callEnd ? "block" : "none" }}>
                <FiPhoneOff size={16} strokeWidth={1.8} />
            </a>
            <a href="#" className="btn btn-icon bg-white rounded-circle rounded-circle" data-toggle="tooltip" data-bs-trigger="hover" data-title="Add Calls">
                <FiPlus size={16} strokeWidth={1.8} />
            </a>
            <a href="#" className="btn btn-icon bg-white rounded-circle rounded-circle" data-toggle="tooltip" data-bs-trigger="hover" data-title="Hold Call">
                <FiPause size={16} strokeWidth={1.8} />
            </a>
        </div>
    )
}

export default CallAction