import { Metadata } from "next";
import SMSDevicesClient from "./sms-devices-client";

export const metadata: Metadata = {
  title: "SMS Devices | Super Admin",
};

export default function SMSDevicesPage() {
  return <SMSDevicesClient />;
}
