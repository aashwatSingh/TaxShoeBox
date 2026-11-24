import { Mark } from './Brand'

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-modal flex flex-col items-center justify-center gap-4 bg-void" role="status">
      <Mark size={28} className="text-ink" />
      <span className="h-px w-24 overflow-hidden bg-ink/10">
        <span className="loader-bar block h-full w-1/3 bg-signal" />
      </span>
      <span className="sr-only">Loading</span>
    </div>
  )
}
