import { addMonths, addYears, endOfMonth, isLastDayOfMonth } from "date-fns";
import { BillingInterval } from "@prisma/client";

/**
 * Calculates the next period end date based on a billing interval.
 * Correctly handles calendar-aware math (e.g., end of month).
 */
export function calculateNextPeriod(startDate: Date, interval: BillingInterval): Date {
  const isStartLastDay = isLastDayOfMonth(startDate);

  let nextDate = startDate;

  switch (interval) {
    case "MONTH":
      nextDate = addMonths(startDate, 1);
      break;
    case "QUARTER":
      nextDate = addMonths(startDate, 3);
      break;
    case "HALF_YEAR":
      nextDate = addMonths(startDate, 6);
      break;
    case "YEAR":
      nextDate = addYears(startDate, 1);
      break;
    default:
      nextDate = addMonths(startDate, 1);
      break;
  }

  // If the start date was the last day of a month, 
  // snap the next date to the last day of the target month.
  if (isStartLastDay) {
    nextDate = endOfMonth(nextDate);
  }

  return nextDate;
}
