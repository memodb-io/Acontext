'use client';

import type { ReactNode, ReactElement } from 'react';
import { Children, isValidElement, cloneElement, createContext, useContext } from 'react';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';

const AccordionGroupCtx = createContext(false);

// ---------------------------------------------------------------------------
// CardGroup / Card
// ---------------------------------------------------------------------------

export function MintCardGroup({
  children,
  cols,
}: {
  children: ReactNode;
  cols?: number;
}) {
  return (
    <Cards
      style={
        cols
          ? ({ '--fd-cards-cols': cols } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </Cards>
  );
}

export function MintCard({
  title,
  icon,
  iconType: _iconType,
  href,
  children,
}: {
  title: string;
  icon?: string;
  iconType?: string;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <Card title={title} href={href} description={typeof children === 'string' ? children : undefined}>
      {typeof children !== 'string' ? children : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CodeGroup — parses fenced code blocks and renders as Tabs
// ---------------------------------------------------------------------------

function extractLabel(props: Record<string, unknown>): string {
  if (typeof props.title === 'string' && props.title) return props.title;
  if (typeof props['data-title'] === 'string' && props['data-title'])
    return props['data-title'] as string;
  if (typeof props['data-language'] === 'string' && props['data-language'])
    return props['data-language'] as string;
  return 'Code';
}

export function MintCodeGroup({ children }: { children: ReactNode }) {
  const items: string[] = [];
  const contents: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    items.push(extractLabel(props));
    contents.push(
      props.title
        ? cloneElement(child as ReactElement<Record<string, unknown>>, { title: undefined })
        : child,
    );
  });

  if (items.length === 0) return <>{children}</>;

  const seen = new Map<string, number>();
  const uniqueItems = items.map((label) => {
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    return count === 0 ? label : `${label} (${count + 1})`;
  });

  return (
    <Tabs items={uniqueItems}>
      {contents.map((content, i) => (
        <Tab key={uniqueItems[i]} value={uniqueItems[i]}>
          {content}
        </Tab>
      ))}
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Tabs / Tab
// ---------------------------------------------------------------------------

export function MintTabs({ children }: { children: ReactNode }) {
  const items: string[] = [];
  const tabs: ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    const title = (props.title as string) || `Tab ${items.length + 1}`;
    items.push(title);
    tabs.push(
      <Tab key={title} value={title}>
        {props.children as ReactNode}
      </Tab>,
    );
  });

  return <Tabs items={items}>{tabs}</Tabs>;
}

export function MintTab({
  title: _title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Steps / Step
// ---------------------------------------------------------------------------

export function MintSteps({ children }: { children: ReactNode }) {
  return <Steps>{children}</Steps>;
}

export function MintStep({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Step>
      {title && <h3>{title}</h3>}
      {children}
    </Step>
  );
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export function MintFrame({
  children,
  caption,
}: {
  children: ReactNode;
  caption?: string;
}) {
  return (
    <figure className="my-4 overflow-hidden rounded-lg border">
      <div className="flex items-center justify-center">{children}</div>
      {caption && (
        <figcaption className="border-t bg-fd-muted px-4 py-2 text-center text-sm text-fd-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// AccordionGroup / Accordion
// ---------------------------------------------------------------------------

export function MintAccordionGroup({ children }: { children: ReactNode }) {
  return (
    <AccordionGroupCtx.Provider value={true}>
      <Accordions type="multiple">{children}</Accordions>
    </AccordionGroupCtx.Provider>
  );
}

export function MintAccordion({
  title,
  icon: _icon,
  children,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
}) {
  const inGroup = useContext(AccordionGroupCtx);
  const inner = <Accordion title={title}>{children}</Accordion>;
  if (inGroup) return inner;
  return <Accordions type="single">{inner}</Accordions>;
}

// ---------------------------------------------------------------------------
// Callouts: Info, Warning, Tip, Note, Check
// ---------------------------------------------------------------------------

export function MintInfo({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

export function MintWarning({ children }: { children: ReactNode }) {
  return <Callout type="warn">{children}</Callout>;
}

export function MintTip({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

export function MintNote({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

export function MintCheck({ children }: { children: ReactNode }) {
  return <Callout type="info">{children}</Callout>;
}

// ---------------------------------------------------------------------------
// ParamField
// ---------------------------------------------------------------------------

export function MintParamField({
  path,
  type,
  required,
  children,
}: {
  path?: string;
  type?: string;
  required?: boolean;
  default?: string;
  children?: ReactNode;
}) {
  return (
    <div className="my-2 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <code className="font-semibold">{path}</code>
        {type && (
          <span className="rounded bg-fd-muted px-1.5 py-0.5 text-xs text-fd-muted-foreground">
            {type}
          </span>
        )}
        {required && (
          <span className="text-xs font-medium text-red-500">required</span>
        )}
      </div>
      {children && (
        <div className="mt-1 text-sm text-fd-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
