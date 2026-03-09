import * as React from "react"
import { 
  format, 
  startOfMonth, 
  startOfYear, 
  startOfYesterday, 
  startOfToday, 
  subDays, 
  endOfToday, 
  endOfYesterday,
  subMonths,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  setHours,
  setMinutes
} from "date-fns"
import { Calendar as CalendarIcon, Clock, ChevronDown, Check, ArrowRight } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DatePickerWithRangeProps {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: DatePickerWithRangeProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [localDate, setLocalDate] = React.useState<DateRange | undefined>(date)
  const [activeTab, setActiveTab] = React.useState<"fixed" | "rolling">("fixed")
  const [selectionStep, setSelectionStep] = React.useState<0 | 1>(0)
  
  const [rollingValue, setRollingValue] = React.useState("30")
  const [rollingUnit, setRollingUnit] = React.useState("days")

  const presets = [
    { label: "Today", getValue: () => ({ from: startOfToday(), to: endOfToday() }) },
    { label: "Yesterday", getValue: () => ({ from: startOfYesterday(), to: endOfYesterday() }) },
    { label: "Last 7 days", getValue: () => ({ from: subDays(startOfToday(), 6), to: endOfToday() }) },
    { label: "Last 30 days", getValue: () => ({ from: subDays(startOfToday(), 29), to: endOfToday() }) },
    { label: "Last 90 days", getValue: () => ({ from: subDays(startOfToday(), 89), to: endOfToday() }) },
    { label: "Last 365 days", getValue: () => ({ from: subDays(startOfToday(), 364), to: endOfToday() }) },
    { label: "Last month", getValue: () => ({ from: startOfMonth(subMonths(startOfToday(), 1)), to: endOfMonth(subMonths(startOfToday(), 1)) }) },
    { label: "Last week", getValue: () => ({ from: startOfWeek(subDays(startOfToday(), 7)), to: endOfWeek(subDays(startOfToday(), 7)) }) },
    { label: "Month to date", getValue: () => ({ from: startOfMonth(startOfToday()), to: endOfToday() }) },
    { label: "Year to date", getValue: () => ({ from: startOfYear(startOfToday()), to: endOfToday() }) },
  ]

  React.useEffect(() => {
    if (isOpen) {
      setLocalDate(date)
      setSelectionStep(0)
    }
  }, [isOpen, date])

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range) {
      setLocalDate(undefined)
      setSelectionStep(0)
      return
    }

    // Custom selection logic: 1st click = single day, 2nd click = range
    if (selectionStep === 0) {
      const day = range.from || range.to
      if (day) {
        const from = setMinutes(setHours(day, 0), 0)
        const to = setMinutes(setHours(day, 23), 59)
        setLocalDate({ from, to })
        setSelectionStep(1)
      }
    } else {
      const end = range.to || range.from
      if (localDate?.from && end) {
        let from = localDate.from
        let to = setMinutes(setHours(end, 23), 59)
        if (to < from) {
            const temp = from
            from = setMinutes(setHours(to, 0), 0)
            to = setMinutes(setHours(temp, 23), 59)
        }
        setLocalDate({ from, to })
        setSelectionStep(0)
      }
    }
  }

  const handleRollingChange = (val: string, unit: string) => {
    setRollingValue(val)
    setRollingUnit(unit)
    const count = parseInt(val) || 0
    let from = startOfToday()
    const to = endOfToday()

    if (unit === "days") from = subDays(startOfToday(), count - 1)
    if (unit === "weeks") from = subDays(startOfToday(), (count * 7) - 1)
    if (unit === "months") from = subMonths(startOfToday(), count)
    
    setLocalDate({ from, to })
    setSelectionStep(0)
  }

  const HourMinutePicker = ({ date, onDateChange, defaultHour }: { 
    date: Date | undefined, 
    onDateChange: (d: Date) => void,
    defaultHour: number
  }) => {
    if (!date) return null;
    return (
        <div className="flex items-center gap-1.5 flex-1 p-1 bg-muted/20 rounded-xl border border-muted/20">
            <Select 
                value={format(date, "HH")} 
                onValueChange={(h) => onDateChange(setHours(date, parseInt(h)))}
            >
                <SelectTrigger className="h-7 border-none bg-transparent font-bold text-[10px] w-12 px-2 shadow-none focus:ring-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg shadow-2xl max-h-40">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <SelectItem key={i} value={i.toString().padStart(2, '0')} className="text-[10px] font-bold">
                            {format(setHours(new Date(), i), "ha")}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <span className="text-muted-foreground opacity-30 font-bold">:</span>
            <Select 
                value={format(date, "mm")} 
                onValueChange={(m) => onDateChange(setMinutes(date, parseInt(m)))}
            >
                <SelectTrigger className="h-7 border-none bg-transparent font-bold text-[10px] w-12 px-2 shadow-none focus:ring-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg shadow-2xl max-h-40">
                    {Array.from({ length: 60 }).map((_, i) => (
                        <SelectItem key={i} value={i.toString().padStart(2, '0')} className="text-[10px] font-bold">
                            {i.toString().padStart(2, '0')}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 opacity-20 hover:opacity-100 transition-opacity"
                onClick={() => onDateChange(setMinutes(setHours(date, defaultHour), defaultHour === 0 ? 0 : 59))}
            >
                <Check className="h-2.5 w-2.5" />
            </Button>
        </div>
    )
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[260px] justify-between text-left font-bold h-11 bg-card border-muted-foreground/10 hover:border-primary/50 rounded-xl px-4 transition-all",
              !date && "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 opacity-50" />
                <span className="text-[11px] uppercase tracking-widest">
                {date?.from ? (
                    date.to ? (
                        `${format(date.from, "MMM d")} - ${format(date.to, "MMM d, yyyy")}`
                    ) : format(date.from, "MMM d, yyyy")
                    ) : "Select Range"}
                </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-30" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[100vw] sm:w-[840px] max-h-[90vh] overflow-y-auto p-0 flex flex-col sm:flex-row shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-t-3xl sm:rounded-3xl border-muted/20 bg-card overflow-hidden" align="end" side="bottom" sideOffset={5}>
          {/* Presets: horizontal scroll on mobile, sidebar on desktop */}
          <div className="hidden sm:flex w-[200px] border-r border-muted/20 flex-col p-2 bg-muted/5">
             <div className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 mb-1">Presets</div>
             <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                {presets.map((preset) => {
                  const pVal = preset.getValue()
                  const isActive = localDate?.from && localDate?.to && 
                    format(pVal.from, 'yyyy-MM-dd') === format(localDate.from, 'yyyy-MM-dd') &&
                    format(pVal.to, 'yyyy-MM-dd') === format(localDate.to, 'yyyy-MM-dd');

                  return (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-[11px] font-bold h-9 px-3 rounded-lg transition-colors group",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => {
                        setLocalDate(preset.getValue())
                        setActiveTab("fixed")
                        setSelectionStep(0)
                      }}
                    >
                      <span className="flex-1 text-left">{preset.label}</span>
                      {isActive && <Check className="ml-2 h-3.5 w-3.5 text-primary stroke-[3]" />}
                    </Button>
                  )
                })}
             </div>
          </div>

          {/* Mobile presets - horizontal scroll */}
          <div className="sm:hidden flex overflow-x-auto gap-1.5 px-3 py-2 border-b border-muted/20 bg-muted/5 no-scrollbar">
            {presets.map((preset) => {
              const pVal = preset.getValue()
              const isActive = localDate?.from && localDate?.to && 
                format(pVal.from, 'yyyy-MM-dd') === format(localDate.from, 'yyyy-MM-dd') &&
                format(pVal.to, 'yyyy-MM-dd') === format(localDate.to, 'yyyy-MM-dd');
              return (
                <Button
                  key={preset.label}
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "shrink-0 text-[10px] font-bold h-7 px-3 rounded-full",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => {
                    setLocalDate(preset.getValue())
                    setActiveTab("fixed")
                    setSelectionStep(0)
                  }}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-muted/20 bg-muted/5 flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-fit">
                    <TabsList className="h-9 bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger value="fixed" className="rounded-lg text-[10px] font-black uppercase tracking-widest h-7 px-4">Fixed</TabsTrigger>
                        <TabsTrigger value="rolling" className="rounded-lg text-[10px] font-black uppercase tracking-widest h-7 px-4">Rolling</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Button 
                    variant="ghost" 
                    className="text-[9px] font-black uppercase tracking-widest h-7 opacity-30 hover:opacity-100 hover:text-destructive"
                    onClick={() => {
                        setLocalDate(undefined)
                        setSelectionStep(0)
                    }}
                >
                    Clear Range
                </Button>
            </div>

            <div className="flex-1 p-4 sm:p-6 space-y-6 sm:space-y-10">
                <Tabs value={activeTab}>
                    <TabsContent value="fixed" className="m-0 space-y-6 sm:space-y-8">
                        <div className="space-y-2">
                            {/* Inputs Grid - stacked on mobile */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="flex-1 space-y-2">
                                    <Input 
                                        type="text" 
                                        value={localDate?.from ? format(localDate.from, "MMMM d, yyyy") : ""} 
                                        placeholder="Start Date"
                                        readOnly
                                        className="h-10 border-muted/20 bg-card font-bold text-xs rounded-xl shadow-sm px-4"
                                    />
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 opacity-20 ml-1" />
                                        <HourMinutePicker 
                                          date={localDate?.from} 
                                          defaultHour={0}
                                          onDateChange={(d) => {
                                            if (localDate) {
                                              setLocalDate({ ...localDate, from: d });
                                            }
                                          }}
                                        />
                                    </div>
                                </div>
                                <ArrowRight className="hidden sm:block h-3.5 w-3.5 opacity-20 shrink-0 mt-[-24px]" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex gap-2">
                                        <Input 
                                            type="text" 
                                            value={localDate?.to ? format(localDate.to, "MMMM d, yyyy") : ""} 
                                            placeholder="End Date"
                                            readOnly
                                            className="h-10 flex-1 border-muted/20 bg-card font-bold text-xs rounded-xl shadow-sm px-4"
                                        />
                                        <div className="h-10 w-10 shrink-0 rounded-xl border border-muted/20 bg-muted/5 flex items-center justify-center opacity-40">
                                            <CalendarIcon className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 opacity-20 ml-1" />
                                        <HourMinutePicker 
                                          date={localDate?.to} 
                                          defaultHour={23}
                                          onDateChange={(d) => {
                                            if (localDate) {
                                              setLocalDate({ ...localDate, to: d });
                                            }
                                          }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Calendar - 1 month mobile, 2 months desktop */}
                        <div className="flex justify-center pt-2 overflow-x-auto">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={localDate?.from}
                                selected={localDate}
                                onSelect={handleCalendarSelect}
                                numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2}
                                disabled={{ after: new Date() }}
                                className="p-0"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="rolling" className="m-0 space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-6 sm:py-10 px-4 sm:px-6 bg-primary/5 rounded-2xl sm:rounded-3xl border border-primary/10">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-primary">Last</div>
                            <Input 
                                type="number" 
                                value={rollingValue}
                                onChange={(e) => handleRollingChange(e.target.value, rollingUnit)}
                                className="w-24 h-12 bg-card border-primary/20 text-center font-black text-2xl rounded-xl focus:ring-primary/20"
                            />
                            <Select value={rollingUnit} onValueChange={(v) => handleRollingChange(rollingValue, v)}>
                                <SelectTrigger className="w-44 h-12 bg-card border-primary/20 font-bold uppercase text-[11px] tracking-widest rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-muted/20 shadow-2xl">
                                    <SelectItem value="days" className="font-bold text-[11px] uppercase">Days</SelectItem>
                                    <SelectItem value="weeks" className="font-bold text-[11px] uppercase">Weeks</SelectItem>
                                    <SelectItem value="months" className="font-bold text-[11px] uppercase">Months</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex-1 text-left sm:text-right">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Active Range:</span>
                                <div className="text-xs font-bold text-primary mt-1">
                                    {localDate?.from && format(localDate.from, "MMM d")} - {localDate?.to && format(localDate.to, "MMM d, yyyy")}
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground px-4 sm:px-6 py-2 opacity-50 bg-muted/10 rounded-xl w-fit">
                            * This range will automatically shift forward as time progresses.
                        </p>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="p-4 border-t border-muted/20 flex justify-end gap-3 bg-muted/5">
                <Button 
                    variant="ghost" 
                    className="font-black uppercase text-[10px] tracking-widest h-10 px-6"
                    onClick={() => {
                        setLocalDate(date)
                        setIsOpen(false)
                    }}
                >
                    Cancel
                </Button>
                <Button 
                    className="bg-[#1a1a1a] text-white hover:bg-black font-black uppercase text-[10px] tracking-widest h-10 px-8 rounded-xl shadow-lg transition-all"
                    onClick={() => {
                        setDate(localDate)
                        setIsOpen(false)
                    }}
                >
                    Apply Range
                </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

