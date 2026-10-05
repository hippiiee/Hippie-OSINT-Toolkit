import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function VulnotesPromotion({ detailed = false }: { detailed?: boolean }) {
  return (
    <section
      aria-labelledby="vulnotes-heading"
      className={cn('mx-auto max-w-6xl', detailed ? 'mt-6' : 'mb-4')}
    >
      <a
        href="https://vulnotes.com/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Learn more about Vulnotes pentest reporting software"
        className={cn(
          'group grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl border border-emerald-200/70 bg-gradient-to-r from-white to-emerald-50/80 transition-colors hover:border-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-slate-700 dark:from-slate-900 dark:to-emerald-950/30 dark:hover:border-emerald-500/50 dark:focus-visible:outline-[#94f7b9] sm:grid-cols-[auto_minmax(0,1fr)_auto]',
          detailed ? 'gap-x-6 gap-y-4 px-5 py-5 sm:px-6' : 'gap-x-4 gap-y-2 px-4 py-3',
        )}
      >
        <div className={cn('col-start-1 row-start-1 max-w-full', detailed ? 'w-40 sm:w-48' : 'w-36 sm:w-40')}>
          <Image
            src="/images/vulnotes-light.svg"
            alt="Vulnotes"
            width={2401}
            height={732}
            className="h-auto w-full dark:hidden"
          />
          <Image
            src="/images/vulnotes-dark.svg"
            alt="Vulnotes"
            width={2401}
            height={732}
            className="hidden h-auto w-full dark:block"
          />
        </div>
        <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <h2 id="vulnotes-heading" className={cn('font-semibold text-slate-900 dark:text-white', detailed ? 'text-lg' : 'text-sm')}>
            {detailed ? 'Better pentest reports, from start to finish.' : 'Pentest reporting, made simple.'}
          </h2>
          {detailed ? (
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                Vulnotes helps security teams write findings, review work together, and create
                polished pentest reports with reusable, branded templates.
              </p>
              <p>
                Export to PDF or Word, and choose cloud hosting or deployment on your own infrastructure.
                Spend less time formatting and more time on your findings.
              </p>
            </div>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Write findings. Review together. Deliver.
            </p>
          )}
        </div>
        <span className="col-start-2 row-start-1 inline-flex h-8 items-center gap-1.5 justify-self-end whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition-colors group-hover:bg-emerald-800 dark:bg-[#94f7b9] dark:text-slate-950 dark:group-hover:bg-[#b4facd] sm:col-start-3">
          Learn more
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </span>
      </a>
    </section>
  )
}
