import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import {
  MintCardGroup,
  MintCard,
  MintCodeGroup,
  MintTabs,
  MintTab,
  MintSteps,
  MintStep,
  MintFrame,
  MintAccordionGroup,
  MintAccordion,
  MintInfo,
  MintWarning,
  MintTip,
  MintNote,
  MintCheck,
  MintParamField,
} from '@/components/mintlify-compat';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    CardGroup: MintCardGroup,
    Card: MintCard,
    CodeGroup: MintCodeGroup,
    Tabs: MintTabs,
    Tab: MintTab,
    Steps: MintSteps,
    Step: MintStep,
    Frame: MintFrame,
    AccordionGroup: MintAccordionGroup,
    Accordion: MintAccordion,
    Info: MintInfo,
    Warning: MintWarning,
    Tip: MintTip,
    Note: MintNote,
    Check: MintCheck,
    ParamField: MintParamField,
    ...components,
  };
}
