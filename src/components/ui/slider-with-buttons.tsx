import { ChevronUp, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface SliderWithButtonsProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  fineStep?: number;
  unit?: string;
}

export function SliderWithButtons({
  label,
  value,
  onChange,
  min,
  max,
  step,
  fineStep = 0.1,
  unit = "%",
}: SliderWithButtonsProps) {
  const increment = () => onChange(Math.min(max, value + fineStep));
  const decrement = () => onChange(Math.max(min, value - fineStep));

  return (
    <div className="space-y-2">
      <Label className="text-xs">
        {label}: {unit === "px" ? Math.round(value) : value.toFixed(1)}{unit}
      </Label>
      <div className="flex items-center gap-1">
        <Slider
          value={[value]}
          onValueChange={([val]) => onChange(val)}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <div className="flex flex-col">
          <button
            type="button"
            className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
            onClick={increment}
            tabIndex={-1}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
            onClick={decrement}
            tabIndex={-1}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
