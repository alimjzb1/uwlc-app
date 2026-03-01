import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZES = [
  { label: '20', value: '20' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
  { label: '200', value: '200' },
  { label: '500', value: '500' },
  { label: '1000', value: '1000' },
  { label: 'All', value: 'all' },
];

interface PageSizeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PageSizeSelector({ value, onChange, className }: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
        Show
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[85px] rounded-xl bg-card/80 border-muted-foreground/10 font-black text-xs uppercase tracking-wider">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-muted/20 shadow-2xl bg-popover/95 backdrop-blur-lg">
          {PAGE_SIZES.map((size) => (
            <SelectItem
              key={size.value}
              value={size.value}
              className="font-bold text-sm tracking-tight rounded-lg focus:bg-primary/10 focus:text-primary"
            >
              {size.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
