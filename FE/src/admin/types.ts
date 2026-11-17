import type { AdminSnapshot, Garden, User } from "../api/types";

export type { Device, DeviceState, GardenStatus } from "../api/types";

export type Section = "overview" | "customers" | "gardens" | "devices" | "sim";

/** 관리자 화면에서 고객은 운영자 계정이다. */
export type Customer = User;
export type AdminGarden = Garden;
export type AdminData = AdminSnapshot;

export type Detail = { kind: "customer" | "garden" | "device"; id: string };
