import { describe, expect, it } from "vitest";
import {
  assertAppointmentStatusTransition,
  canRescheduleAppointment,
  canTransitionAppointmentStatus,
  getRescheduledAppointmentStatus,
} from "@/lib/operations/appointments-lifecycle";

describe("appointments lifecycle helpers", () => {
  it("allows expected status transitions", () => {
    expect(canTransitionAppointmentStatus("scheduled", "confirmed")).toBe(true);
    expect(canTransitionAppointmentStatus("confirmed", "completed")).toBe(true);
    expect(canTransitionAppointmentStatus("cancelled", "scheduled")).toBe(true);
  });

  it("blocks invalid status transitions", () => {
    expect(canTransitionAppointmentStatus("completed", "scheduled")).toBe(false);
    expect(canTransitionAppointmentStatus("cancelled", "completed")).toBe(false);
    expect(() =>
      assertAppointmentStatusTransition("completed", "cancelled")
    ).toThrow('Cannot transition appointment from "completed" to "cancelled"');
  });

  it("marks only completed appointments as non-reschedulable", () => {
    expect(canRescheduleAppointment("scheduled")).toBe(true);
    expect(canRescheduleAppointment("confirmed")).toBe(true);
    expect(canRescheduleAppointment("cancelled")).toBe(true);
    expect(canRescheduleAppointment("no_show")).toBe(true);
    expect(canRescheduleAppointment("completed")).toBe(false);
  });

  it("reopens cancelled and no-show appointments to scheduled on reschedule", () => {
    expect(getRescheduledAppointmentStatus("cancelled")).toBe("scheduled");
    expect(getRescheduledAppointmentStatus("no_show")).toBe("scheduled");
    expect(getRescheduledAppointmentStatus("confirmed")).toBe("confirmed");
  });
});
