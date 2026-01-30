'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface FAQItem {
  question: string
  answer: string | React.ReactNode
}

interface FAQProps {
  items?: FAQItem[]
}

const defaultFAQs: FAQItem[] = [
  {
    question: 'What payment methods do you accept?',
    answer:
      'We use Stripe for secure payment processing. We accept all major credit cards (Visa, Mastercard, American Express) and other payment methods supported by Stripe. All payments are processed securely through Stripe.',
  },
  {
    question: 'Can I change my plan later?',
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Plan changes will take effect at the start of your next billing cycle. We'll prorate any charges or credits to your account based on your billing cycle.",
  },
  {
    question: 'What happens if I exceed my plan limits?',
    answer:
      "For paid plans (Pro and Team), if you exceed your plan limits, you'll be charged for the additional usage on a pay-as-you-go basis. Your service will continue without interruption. The Free plan has hard limits and may require an upgrade to continue using the service.",
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer:
      'Absolutely. You can cancel your subscription at any time with no cancellation fees. Your access will continue until the end of your current billing period.',
  },
  {
    question: 'Are you going to change your pricing in the future?',
    answer:
      'Our pricing is in Beta. Pricing may change in the future, however as a team of developers we are committed to pricing being as developer friendly as possible.',
  },
  {
    question: 'Can I self-host Acontext for free?',
    answer: (
      <>
        Yes, you can use {' '}
        <Link
          href="https://docs.acontext.io/quick#self-hosted"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
          aria-label="View Docker setup documentation (opens in new tab)"
        >
          Acontext Docker CLI
        </Link>.
      </>
    ),
  },
]

function FAQItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'border border-border/50 rounded-lg overflow-hidden',
        'bg-card/50 backdrop-blur',
        'transition-all duration-300',
        isOpen && 'border-border/80 shadow-md',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <h3 className="text-base font-semibold text-foreground pr-4">{item.question}</h3>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300',
            isOpen && 'transform rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-6 pb-4">
          <div className="text-sm text-muted-foreground leading-relaxed">{item.answer}</div>
        </div>
      </div>
    </div>
  )
}

export function FAQ({ items = defaultFAQs }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[768px] lg:max-w-[1200px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about our pricing and plans.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {items.map((item, index) => (
            <FAQItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => toggleItem(index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
