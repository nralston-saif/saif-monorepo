# SAIF Rejection Email Agent

A Claude Code agent for generating professional, empathetic rejection emails for SAIF (Safe AI Fund) applications.

## Overview

This agent helps the SAIF team quickly generate consistent, professional rejection emails based on internal review notes. It:

- Follows a consistent email structure
- Matches tone to the SAIF brand
- Translates internal notes into professional feedback
- Personalizes based on application details
- Never reveals harsh internal assessments

## Files

- `CLAUDE.md` - Agent instructions and examples for Claude Code
- `saif_rejection_agent.py` - Python utility for template-based generation
- `sample_applications.json` - Example application data for testing

## Usage with Claude Code

### Basic Usage

```bash
# In your terminal with Claude Code
claude

# Then provide the application details and ask for a rejection email:
"Write a SAIF rejection email for:
- Company: Acme AI
- Founder: John Smith (john@acme.ai)
- Description: AI-powered productivity dashboard
- Internal Notes: Not AI safety, no tech background
"
```

### With the Python Script

```bash
# Show example emails
python saif_rejection_agent.py --examples

# Interactive mode
python saif_rejection_agent.py --interactive

# Command line
python saif_rejection_agent.py \
  --company "Acme AI" \
  --founders "John Smith" \
  --contact "john@acme.ai" \
  --description "AI-powered productivity dashboard" \
  --reason "not_ai_safety"
```

## Rejection Categories

| Category | When to Use |
|----------|-------------|
| `not_ai_safety` | Valuable product but not safety-focused |
| `early_stage_no_team` | Solo founder, no cofounder, part-time |
| `no_tech_cofounder` | Safety-critical product lacks tech leadership |
| `too_conceptual` | Ambitious ideas but no clear implementation path |
| `safety_angle_unclear` | Could relate to safety but connection unconvincing |
| `not_for_profit` | L3C, non-profit, no equity path |
| `general_not_aligned` | General misalignment with SAIF focus |

## Email Structure

Every email follows this structure:

1. **Greeting** - "Hi [Name]," or "Hi there,"
2. **Opening** - Thanks + unfortunately doesn't fit
3. **Feedback** - Specific, nuanced explanation (the main paragraph)
4. **Well Wishes** - Brief, genuine closing
5. **Sign-off** - "Best, The SAIF Team"

## Best Practices

### Do:
- Acknowledge something positive about the application
- Be specific about the misfit
- End with genuine well wishes
- Offer path forward when appropriate
- Keep emails concise (2-3 paragraphs)

### Don't:
- Share internal notes verbatim
- Be condescending
- Promise future investment
- Give detailed feedback that invites debate
- Make emails too long

## Example Output

**Input:**
```
Company: Tova
Contact: hello@tovaapp.com
Description: AI safety companion that helps people spot romance and investment scams
Internal Notes: No technical founder. Beta is probably vibe coded.
```

**Output:**
```
Hi there,

Thanks very much for expressing interest in being part of SAIF and our efforts 
to create a better future with AI. Unfortunately at this time we don't think 
that Tova fits within the criteria we are using for our fund.

Helping users detect scams and risky interactions in real time is an important 
problem, and we can see the appeal of a product that integrates directly into 
messaging and financial platforms. However, SAIF typically looks for teams with 
strong technical founding leadership given the complexity and competitiveness 
of building safety-critical AI systems. At this stage, and without a technical 
cofounder driving the core system, we don't believe Tova is the right fit for 
SAIF's focus.

We wish you the best as you continue developing the product and exploring 
partnerships.

Best,
The SAIF Team
```

## Customization

The `CLAUDE.md` file contains all the patterns and examples. Modify it to:

- Add new rejection categories
- Update the email structure
- Change the tone
- Add new examples
