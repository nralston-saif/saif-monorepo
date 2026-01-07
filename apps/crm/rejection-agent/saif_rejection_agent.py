#!/usr/bin/env python3
"""
SAIF Application Rejection Email Generator

This script generates rejection emails for SAIF (Safe AI Fund) applications
based on the patterns and examples provided by the SAIF team.

Usage:
    python saif_rejection_agent.py --company "Company Name" --contact "email@example.com" \
        --description "Company description" --rejection-reason "reason"

Or use interactively:
    python saif_rejection_agent.py --interactive
"""

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class Application:
    """Represents a SAIF application."""
    company_name: str
    contact_email: str
    founder_names: Optional[str]
    description: str
    rejection_reasons: list[str]


# Common rejection reason templates based on the examples
REJECTION_TEMPLATES = {
    "not_ai_safety": {
        "summary": "Product is not focused on AI safety",
        "template": """Your work on {product_focus} is meaningful and clearly impactful. However, {company_name} is focused on {actual_focus} rather than on technologies that directly improve safety and security in the presence of risks created by advanced AI systems. Because of this, the project falls outside the scope of SAIF's investment mandate."""
    },
    "early_stage_no_team": {
        "summary": "Too early stage with incomplete founding team",
        "template": """{product_area} is an important direction, and we can see why this category will matter as agentic systems become more widely deployed. However, {company_name} is still at a very early stage, and we generally look for teams with a committed founding group, clear technical ownership, and a more defined product trajectory before engaging as investors. Given the current state of the team and the work, we don't believe this is the right fit for SAIF at this time."""
    },
    "no_tech_cofounder": {
        "summary": "Lacks technical founding leadership",
        "template": """{problem_statement} is an important problem, and we can see the appeal of a product that {product_appeal}. However, SAIF typically looks for teams with strong technical founding leadership given the complexity and competitiveness of building safety-critical AI systems. At this stage, and without a technical cofounder driving the core system, we don't believe {company_name} is the right fit for SAIF's focus."""
    },
    "too_conceptual": {
        "summary": "Approach is too conceptual or lacks clear technical pathway",
        "template": """Your proposal explores ambitious ideas around {topic_area}. However, the approach as described is highly conceptual, and it's difficult for us to assess a clear technical pathway, feasibility, or near-term product direction. SAIF's focus is on companies building practical, deployable technologies that can be validated and scaled to improve safety and security in real-world AI systems, and {company_name} does not currently align with that focus."""
    },
    "safety_angle_unclear": {
        "summary": "Safety impact is not clear or central to the product",
        "template": """{company_name}'s approach to {product_description} is thoughtful, and we can see how tools like this could be valuable for {target_users}. However, SAIF's focus is on companies building products that directly improve safety and security in the presence of advanced AI systems, and we are not yet convinced that {company_name}'s safety impact is sufficiently clear or central to the product. In addition, we typically look for teams with a full-time founder."""
    },
    "not_for_profit": {
        "summary": "Not a for-profit company with scalable business model",
        "template": """We appreciate the work you've put into {company_name} and your commitment to developing {mission}. However, SAIF is structured specifically to invest in for-profit companies with scalable business models. As {company_name} is {structure} and won't be offering equity to investors, we do not see a clear path for sufficient venture funding to be raised. Additionally, it is unclear to us that {distribution_concern}."""
    },
    "general_not_aligned": {
        "summary": "General non-alignment with SAIF focus",
        "template": """We appreciate your ambition to {mission}. However, {company_name} appears primarily focused on {actual_focus}, which, while potentially impactful, are not aligned with SAIF's mission. Our focus is specifically centered on companies building products that directly improve safety and security in the presence of threats caused or created by AI systems. Given this focus, {category} sit outside the scope of what we fund."""
    }
}


def generate_rejection_email(application: Application) -> str:
    """
    Generate a rejection email based on the application details and rejection reasons.
    
    The email follows the standard SAIF format:
    1. Opening greeting
    2. Polite decline
    3. Specific feedback paragraph
    4. Well wishes
    5. Closing
    """
    
    # Determine the greeting
    if application.founder_names:
        greeting = f"Hi {application.founder_names},"
    else:
        greeting = "Hi there,"
    
    # Standard opening
    opening = """Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that {company} fits within the criteria we are using for our fund.""".format(
        company=application.company_name
    )
    
    # Generate the specific feedback paragraph based on rejection reasons
    # This is where the agent would use Claude to generate contextual feedback
    feedback = generate_feedback_paragraph(application)
    
    # Standard closing
    closing = f"""We wish you the best as you continue {get_closing_wish(application)}.

Best,
The SAIF Team"""
    
    # Combine all parts
    email = f"""{greeting}

{opening}

{feedback}

{closing}"""
    
    return email


def generate_feedback_paragraph(application: Application) -> str:
    """
    Generate the specific feedback paragraph based on the rejection reasons.
    
    This is a placeholder - in a real implementation, this would use Claude
    to generate contextual, specific feedback based on the application.
    """
    
    # For now, provide a template-based approach
    # In production, this would call Claude API for more nuanced generation
    
    if not application.rejection_reasons:
        return f"While we appreciate your submission, {application.company_name} does not currently align with our investment criteria."
    
    primary_reason = application.rejection_reasons[0]
    
    if primary_reason in REJECTION_TEMPLATES:
        template_info = REJECTION_TEMPLATES[primary_reason]
        # Return the template - in production this would be filled in with details
        return f"[TEMPLATE: {template_info['summary']}]\n{template_info['template']}"
    
    return f"The project does not currently align with SAIF's focus on companies building practical technologies that directly improve safety and security in real-world AI systems."


def get_closing_wish(application: Application) -> str:
    """Generate an appropriate closing wish based on the application."""
    
    # Determine appropriate closing based on what the company does
    description_lower = application.description.lower()
    
    if "building" in description_lower or "develop" in description_lower:
        return "building the company"
    elif "platform" in description_lower:
        return "developing the platform"
    elif "research" in description_lower:
        return "developing your ideas"
    elif "product" in description_lower:
        return "building and refining the product"
    else:
        return "developing your ideas"


def print_examples():
    """Print example rejection emails from the training data."""
    
    examples = [
        {
            "company": "WormAI, Inc. (Sec0)",
            "reason": "Early stage, no cofounder",
            "email": """Hi Ashish,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that Sec0 fits within the criteria we are using for our fund.

Wrapping agent workflows with governance, monitoring, and control layers is an important direction, and we can see why this category will matter as agentic systems become more widely deployed. However, Sec0 is still at a very early stage, and we generally look for teams with a committed founding group, clear technical ownership, and a more defined product trajectory before engaging as investors. Given the current state of the team and the work, we don't believe this is the right fit for SAIF at this time.

We wish you the best as you continue developing the idea and building toward a more complete product.

Best,
The SAIF Team"""
        },
        {
            "company": "Tova",
            "reason": "No technical cofounder",
            "email": """Hi there,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that Tova fits within the criteria we are using for our fund.

Helping users detect scams and risky interactions in real time is an important problem, and we can see the appeal of a product that integrates directly into messaging and financial platforms. However, SAIF typically looks for teams with strong technical founding leadership given the complexity and competitiveness of building safety-critical AI systems. At this stage, and without a technical cofounder driving the core system, we don't believe Tova is the right fit for SAIF's focus.

We wish you the best as you continue developing the product and exploring partnerships.

Best,
The SAIF Team"""
        },
        {
            "company": "VAITION",
            "reason": "Too conceptual",
            "email": """Hi Vadim,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that VAITION fits within the criteria we are using for our fund.

Your proposal explores ambitious ideas around human presence and trust in digital systems. However, the approach as described is highly conceptual, and it's difficult for us to assess a clear technical pathway, feasibility, or near-term product direction. SAIF's focus is on companies building practical, deployable technologies that can be validated and scaled to improve safety and security in real-world AI systems, and VAITION does not currently align with that focus.

We appreciate you reaching out and wish you the best as you continue developing your ideas.

Best,
The SAIF Team"""
        }
    ]
    
    print("\n" + "="*80)
    print("EXAMPLE REJECTION EMAILS FROM SAIF")
    print("="*80)
    
    for i, example in enumerate(examples, 1):
        print(f"\n--- Example {i}: {example['company']} ---")
        print(f"Rejection Reason: {example['reason']}")
        print("-" * 40)
        print(example['email'])
        print()


def interactive_mode():
    """Run the agent in interactive mode."""
    
    print("\n" + "="*60)
    print("SAIF Rejection Email Generator - Interactive Mode")
    print("="*60)
    
    print("\nEnter application details:")
    
    company_name = input("Company Name: ").strip()
    contact_email = input("Contact Email: ").strip()
    founder_names = input("Founder Name(s) [leave blank if unknown]: ").strip() or None
    
    print("\nEnter company description (press Enter twice to finish):")
    description_lines = []
    while True:
        line = input()
        if line == "":
            break
        description_lines.append(line)
    description = "\n".join(description_lines)
    
    print("\nAvailable rejection reasons:")
    for i, (key, value) in enumerate(REJECTION_TEMPLATES.items(), 1):
        print(f"  {i}. {key}: {value['summary']}")
    
    reason_input = input("\nEnter rejection reason number(s), comma-separated: ").strip()
    reason_indices = [int(x.strip()) - 1 for x in reason_input.split(",") if x.strip()]
    rejection_reasons = [list(REJECTION_TEMPLATES.keys())[i] for i in reason_indices if 0 <= i < len(REJECTION_TEMPLATES)]
    
    app = Application(
        company_name=company_name,
        contact_email=contact_email,
        founder_names=founder_names,
        description=description,
        rejection_reasons=rejection_reasons
    )
    
    print("\n" + "="*60)
    print("GENERATED REJECTION EMAIL")
    print("="*60)
    print()
    print(generate_rejection_email(app))


def main():
    parser = argparse.ArgumentParser(
        description="Generate SAIF application rejection emails",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Show example emails:
    python saif_rejection_agent.py --examples
    
  Interactive mode:
    python saif_rejection_agent.py --interactive
    
  Command line mode:
    python saif_rejection_agent.py --company "Acme AI" --contact "founder@acme.ai" \\
        --description "AI productivity tool" --reason "not_ai_safety"
        """
    )
    
    parser.add_argument("--examples", action="store_true", help="Show example rejection emails")
    parser.add_argument("--interactive", action="store_true", help="Run in interactive mode")
    parser.add_argument("--company", type=str, help="Company name")
    parser.add_argument("--contact", type=str, help="Contact email")
    parser.add_argument("--founders", type=str, help="Founder name(s)")
    parser.add_argument("--description", type=str, help="Company description")
    parser.add_argument("--reason", type=str, action="append", help="Rejection reason(s)")
    
    args = parser.parse_args()
    
    if args.examples:
        print_examples()
        return
    
    if args.interactive:
        interactive_mode()
        return
    
    if args.company and args.description:
        app = Application(
            company_name=args.company,
            contact_email=args.contact or "",
            founder_names=args.founders,
            description=args.description,
            rejection_reasons=args.reason or []
        )
        print(generate_rejection_email(app))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
