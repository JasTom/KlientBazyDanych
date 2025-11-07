import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table ref={ref} className={cn("w-full text-sm", className)} {...props} />
  </div>
));
Table.displayName = "Table";

const THead = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-gray-800 text-white", className)} {...props} />
));
THead.displayName = "THead";

const TBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("", className)} {...props} />
));
TBody.displayName = "TBody";

const TR = React.forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn("", className)} {...props} />
));
TR.displayName = "TR";

const TH = React.forwardRef(({ className, ...props }, ref) => (
  <th ref={ref} className={cn("px-2 py-2 text-left align-middle", className)} {...props} />
));
TH.displayName = "TH";

const TD = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-2 py-2 align-middle", className)} {...props} />
));
TD.displayName = "TD";

export { Table, THead, TBody, TR, TH, TD };


