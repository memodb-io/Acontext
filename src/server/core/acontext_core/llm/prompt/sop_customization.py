"""
SOP Prompt Customization Module

This module provides extensible customization for SOP agent prompts.
Currently supports:
- Custom scoring rules (normal: +1, critical: +3)

Future extensions can be added here without breaking existing functionality.
"""
from typing import List
from pydantic import BaseModel
from typing import Literal
from ...schema.config import CustomScoringRule


class SOPPromptCustomization(BaseModel):
    """
    Extensible configuration for customizing SOP agent prompts.
    
    This class is designed to be extended with new customization options
    without breaking backward compatibility.
    """
    custom_scoring_rules: List[CustomScoringRule] = []

    def build_custom_scoring_section(self, start_index: int = 5) -> str:
        """
        Build custom scoring rules section in (c.x) format.
        
        Args:
            start_index: Starting index for custom rules (default 5, after c.4)
            
        Returns:
            Formatted string with custom scoring rules, empty if no rules
        """
        if not self.custom_scoring_rules:
            return ""
        
        rules = []
        for idx, rule in enumerate(self.custom_scoring_rules, start=start_index):
            score = 1 if rule.level == "normal" else 3
            rules.append(f"(c.{idx}) {rule.description}, + {score} point{'s' if score > 1 else ''}")
        
        return "\n".join(rules)
    
    def get_all_rule_indices(self, base_count: int = 4) -> List[str]:
        """
        Get all rule indices including base and custom rules.
        
        Args:
            base_count: Number of base rules (default 4 for c.1-c.4)
            
        Returns:
            List of rule indices like ["(c.1)", "(c.2)", ..., "(c.N)"]
        """
        indices = [f"(c.{i})" for i in range(1, base_count + 1)]
        if self.custom_scoring_rules:
            custom_start = base_count + 1
            for idx in range(custom_start, custom_start + len(self.custom_scoring_rules)):
                indices.append(f"(c.{idx})")
        return indices

