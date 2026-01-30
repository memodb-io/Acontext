'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { cn } from '@/lib/utils'

export interface Price {
  id: string
  product: string
  unit_amount: number
  currency: string
  recurring: {
    interval: string
    interval_count: number
    usage_type: string
    meter: string | null
    trial_period_days: number | null
  }
  name: string
  rank: number
}

export interface ProductDescription {
  pkg: Array<{ title: string; subtitle?: string }>
  pkg_title: string
  plan_desc: string
  original_amount?: number
}

export interface Product {
  plan: string
  product: string
  description: ProductDescription
  original_amount?: number
}

export interface PricingData {
  prices: Price[]
  product: Product[]
}

function formatPrice(unitAmount: number, currency: string = 'usd'): string {
  const amount = unitAmount / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

function findPriceForProduct(prices: Price[], productId: string, planName?: string): Price | null {
  // First try to match by product ID
  let price = prices.find((p) => p.product === productId)

  // If not found and planName is provided, try to match by name (case-insensitive)
  if (!price && planName) {
    price = prices.find((p) => p.name.toLowerCase() === planName.toLowerCase())
  }

  return price || null
}

interface PricingCardProps {
  product: Product
  price: Price | null
  isPopular?: boolean
}

function PricingCard({ product, price, isPopular = false }: PricingCardProps) {
  const isFree = product.plan === 'free'
  const displayPrice = isFree
    ? '0'
    : price
      ? formatPrice(price.unit_amount, price.currency)
      : 'Contact us'

  const interval = isFree ? 'month' : price?.recurring.interval || 'month'

  // original_amount is in cents (same unit as unit_amount)
  // Check both product.description.original_amount and product.original_amount
  const originalAmount = product.description.original_amount ?? product.original_amount

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-8 flex flex-col',
        'bg-card/50 backdrop-blur border border-border/50',
        'hover:border-border/80 hover:-translate-y-1 transition-all duration-300',
        'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]',
        isPopular && 'border-primary/50 ring-2 ring-primary/20',
      )}
    >
      {/* Plan header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-foreground capitalize">{product.plan}</h3>
          {isPopular && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Most Popular
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">{product.description.plan_desc}</p>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">{displayPrice}</span>
            <span className="text-muted-foreground">/{interval}</span>
          </div>
          {originalAmount && !isFree && price && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(originalAmount, price.currency)}
              </span>
              <span className="text-sm text-primary font-medium">
                Save {Math.round((1 - price.unit_amount / originalAmount) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 mb-6">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          {product.description.pkg_title}
        </h4>
        <ul className="space-y-3">
          {product.description.pkg.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm text-foreground">{feature.title}</span>
                {feature.subtitle && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {feature.subtitle}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <MagneticButton strength={0.1}>
        <Button
          size="lg"
          className={cn(
            'w-full h-12 text-base font-semibold',
            isPopular && 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
          variant={isPopular ? 'default' : 'outline'}
          asChild
        >
          <a href="https://dash.acontext.io" target="_blank" rel="noopener noreferrer">
            {isFree ? 'Get Started' : 'Get Started'}
          </a>
        </Button>
      </MagneticButton>
    </div>
  )
}

interface PricingTableProps {
  data: PricingData | null
  error?: string | null
}

export function PricingTable({ data, error }: PricingTableProps) {
  if (error || !data) {
    return (
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
          <div className="text-center">
            <p className="text-destructive">{error || 'Failed to load pricing data'}</p>
          </div>
        </div>
      </section>
    )
  }

  // Sort products by plan order: free, pro, team
  const planOrder = ['free', 'pro', 'team']
  const sortedProducts = [...data.product].sort((a, b) => {
    const aIndex = planOrder.indexOf(a.plan)
    const bIndex = planOrder.indexOf(b.plan)
    return aIndex - bIndex
  })

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {sortedProducts.map((product) => {
            const price =
              product.product === 'free'
                ? null
                : findPriceForProduct(data.prices, product.product, product.plan)
            const isPopular = product.plan === 'pro'

            return (
              <PricingCard
                key={product.plan}
                product={product}
                price={price}
                isPopular={isPopular}
              />
            )
          })}
        </div>

        {/* Enterprise Section */}
        <div className="mt-12">
          <div
            className={cn(
              'relative overflow-hidden rounded-xl p-8',
              'bg-card/50 backdrop-blur border border-border/50',
              'hover:border-border/80 transition-all duration-300',
              'shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]',
            )}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 lg:gap-12 items-center">
              {/* Left side - Title and Description */}
              <div>
                <h3 className="text-2xl font-bold text-foreground capitalize mb-4">Enterprise</h3>
                <p className="text-base text-muted-foreground mb-6">
                  For large-scale applications running Internet scale workloads.
                </p>
                <MagneticButton strength={0.1}>
                  <Button
                    size="lg"
                    className="h-12 text-base font-semibold px-8"
                    variant="outline"
                    asChild
                  >
                    <a href="https://dash.acontext.io" target="_blank" rel="noopener noreferrer">
                      Contact Us
                    </a>
                  </Button>
                </MagneticButton>
              </div>

              {/* Right side - Features */}
              <div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    'Designated Support manager',
                    'Uptime SLAs',
                    'BYO Cloud supported',
                    '24×7×365 premium enterprise support',
                    'Private Slack channel',
                    'Custom Security Questionnaires',
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
