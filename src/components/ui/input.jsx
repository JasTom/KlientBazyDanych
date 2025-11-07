import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm shadow-sm outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };


