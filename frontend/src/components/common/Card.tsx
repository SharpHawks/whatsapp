import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: React.ReactNode
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, description, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur transition-all duration-200',
          className
        )}
        {...props}
      >
        {(title || description || action) && (
          <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4">
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
              )}
              {description && (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              )}
            </div>
            {action && <div className="ml-4">{action}</div>}
          </div>
        )}
        <div className={cn(title || description || action ? 'p-6 pt-0' : 'p-6')}>
          {children}
        </div>
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
