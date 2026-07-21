import { DoctorVacation } from "@/lib/types";

// Type for schedule data
export type ScheduleData = {
  [rowKey: string]: {
    [day: string]: {
      value: string[];
      type: "empty" | "doctor" | "shift";
      status: "pending" | "validated";
    };
  };
};

/**
 * Builds a request object for the solver based on current week data
 */
export function buildCurrentWeekRequest(
  weekStartDate: string,
  weekNumber: number,
  vacations: DoctorVacation[],
  doctors: string[]
) {
  return {
    week_start_date: weekStartDate,
    week_number: weekNumber,
    vacations: vacations.map((v) => ({
      doctor: v.doctor,
      start_date: v.start_date,
      end_date: v.end_date,
      type: v.type,
    })),
    doctors: doctors,
    constraints: {
      max_consecutive_shifts: 2,
      min_rest_days: 2,
      prefer_balanced_load: true,
    },
  };
}

/**
 * Converts a solver response into schedule data format
 */
export function convertSolverResponseToScheduleData(solverResponse: any): ScheduleData {
  if (!solverResponse || typeof solverResponse !== "object") {
    return {};
  }

  const scheduleData: ScheduleData = {};

  // Process the solver response and convert it to the expected format
  Object.keys(solverResponse).forEach((rowKey) => {
    if (!scheduleData[rowKey]) {
      scheduleData[rowKey] = {};
    }

    const rowData = solverResponse[rowKey];
    Object.keys(rowData).forEach((day) => {
      const cellData = rowData[day];

      scheduleData[rowKey][day] = {
        value: Array.isArray(cellData) ? cellData : cellData?.value || [],
        type: cellData?.type || "empty",
        status: "pending",
      };
    });
  });

  return scheduleData;
}
