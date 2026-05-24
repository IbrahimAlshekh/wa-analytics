export interface ScheduleSlot {
  id: number;
  startMin: number;
  endMin: number;
}

export interface AccountSchedule {
  forceOffline: boolean;
  slots: ScheduleSlot[];
}
