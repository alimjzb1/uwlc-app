import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-8 sm:space-y-0",
        month: "space-y-4 w-full sm:w-[280px] block",
        caption: "flex justify-center pt-1 relative items-center mb-6",
        caption_label: "text-[11px] font-black uppercase tracking-[0.2em] text-foreground/90",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-lg border-muted-foreground/10"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full mb-2",
        weekday: "text-muted-foreground/40 font-black text-[9px] uppercase tracking-[0.2em] w-[14.28%] flex items-center justify-center h-8",
        week: "flex w-full mt-0.5",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-medium aria-selected:opacity-100 rounded-full flex items-center justify-center mx-auto transition-all"
        ),
        cell: "h-9 w-[14.28%] text-center text-sm p-0 relative [&:has([aria-selected].range-end)]:rounded-r-full [&:has([aria-selected].range-start)]:rounded-l-full [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
        range_start: "range-start bg-primary text-primary-foreground rounded-l-full",
        range_end: "range-end bg-primary text-primary-foreground rounded-r-full",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground !rounded-none",
        today: "bg-accent text-accent-foreground",
        outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
