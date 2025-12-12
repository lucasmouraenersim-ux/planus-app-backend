import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64 bg-slate-800" />
        <div className="flex gap-2">
            <Skeleton className="h-10 w-10 bg-slate-800 rounded-full" />
            <Skeleton className="h-10 w-32 bg-slate-800" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl bg-slate-800/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Skeleton className="h-[400px] lg:col-span-2 rounded-2xl bg-slate-800/50" />
         <Skeleton className="h-[400px] rounded-2xl bg-slate-800/50" />
      </div>
    </div>
  )
}
