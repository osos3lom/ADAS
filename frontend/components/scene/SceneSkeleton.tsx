import { cn } from '@/lib/utils';

interface Props {
  /** Compact variant for use inside the canvas <Html> Suspense fallback. */
  inline?: boolean;
  label?: string;
}

/**
 * Styled loading skeleton shown (a) by next/dynamic while the 3D chunk streams,
 * and (b) inside the Canvas Suspense boundary while HDRI/textures load.
 */
export function SceneSkeleton({ inline = false, label = 'Rendering scene' }: Props) {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-400" />
        <div className="absolute inset-[6px] rounded-full border border-cyan-400/20" />
      </div>
      <div className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300/90">{label}</div>
        {!inline && (
          <div className="mt-1 font-mono text-[10px] text-gray-500">loading lighting &amp; geometry</div>
        )}
      </div>
      {!inline && (
        <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/2 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
        </div>
      )}
    </div>
  );

  if (inline) return spinner;

  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center overflow-hidden',
        'bg-[radial-gradient(circle_at_50%_30%,#16202e_0%,#0a0e16_70%)]',
      )}
      aria-hidden
    >
      {/* faint booting-viewport grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(#22d3ee 1px, transparent 1px), linear-gradient(90deg, #22d3ee 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          maskImage: 'radial-gradient(circle at 50% 55%, black 10%, transparent 75%)',
        }}
      />
      {spinner}
    </div>
  );
}

export default SceneSkeleton;
