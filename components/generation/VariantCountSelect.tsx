"use client";

 interface VariantCountSelectProps {
   value: number;
   onChange: (value: number) => void;
   disabled?: boolean;
 }

 const OPTIONS = Array.from({ length: 8 }, (_, index) => index + 1);

 export function VariantCountSelect({
   value,
   onChange,
   disabled,
 }: VariantCountSelectProps) {
   return (
     <div className="flex items-center gap-2 text-sm">
       <label htmlFor="variant-count" className="text-xs text-gray-500">
         Variants
       </label>
       <select
         id="variant-count"
         value={value}
         onChange={(event) => onChange(Number(event.target.value))}
         disabled={disabled}
         className="px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
       >
         {OPTIONS.map((option) => (
           <option key={option} value={option}>
             {option}
           </option>
         ))}
       </select>
     </div>
   );
 }
