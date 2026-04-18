import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const progressIndicatorVariants = cva('size-full flex-1 transition-all', {
  variants: {
    variant: {
      default: 'bg-primary',
      success: 'bg-emerald-500'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

function Progress({
  className,
  value,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & VariantProps<typeof progressIndicatorVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative flex h-1 w-full items-center overflow-x-hidden rounded-none bg-muted', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        data-variant={variant}
        className={cn(progressIndicatorVariants({ variant }))}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
