import { Spinner } from "@/components/ui/spinner"

export function ProcessingOverlay() {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
      <Spinner className="size-12 text-white mb-4" />
      <p className="text-white text-lg font-medium">Processing...</p>
      <p className="text-zinc-400 text-sm mt-2">Extracting amounts from receipt</p>
    </div>
  )
}
