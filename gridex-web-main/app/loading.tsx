// Loading skeleton displayed during suspense while server components load
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="animate-pulse space-y-4 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-gray-700"></div>
        <p className="text-gray-400">Laddar innehåll …</p>
      </div>
    </div>
  )
}