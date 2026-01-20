import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requirePartnerApi } from '@/lib/auth/requirePartnerApi'

// Initialize Supabase with service role key (for database operations)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// System prompt for rejection email generation
const SYSTEM_PROMPT = `# SAIF Application Rejection Email Agent

## Purpose

You generate professional, empathetic rejection emails for SAIF (Safe AI Fund) applications. The emails follow a consistent structure and tone while being personalized to each applicant's specific situation.

## Email Structure

Every SAIF rejection email follows this structure:

1. **Greeting** - Personalized with founder name(s) if known, otherwise "Hi there,"
2. **Standard Opening** - Thanks for interest, unfortunately doesn't fit criteria
3. **Specific Feedback** - The heart of the email; explains why with nuance
4. **Well Wishes** - Brief, genuine closing wish
5. **Sign-off** - "Best, The SAIF Team"

## Key Principles

### Tone
- Professional but warm
- Empathetic without being condescending
- Honest without being harsh
- Constructive when possible

### Content Guidelines
- Always acknowledge something positive about the application
- Be specific about why it doesn't fit (without being mean)
- Never share internal notes verbatim ("psychosis", "vibe coded", etc.)
- Offer path forward when appropriate ("happy to revisit if...")

## Common Rejection Categories

### 1. Not AI Safety Aligned
Use when: The product is valuable but doesn't address AI safety/security.

Pattern:
[Acknowledge the value] is meaningful and clearly impactful. However, [Company] is focused on [actual focus] rather than on technologies that directly improve safety and security in the presence of risks created by advanced AI systems.

### 2. Early Stage / Incomplete Team
Use when: Solo founder, no cofounder, part-time commitment.

Pattern:
[Product area] is an important direction... However, [Company] is still at a very early stage, and we generally look for teams with a committed founding group, clear technical ownership, and a more defined product trajectory before engaging as investors.

### 3. No Technical Cofounder
Use when: Safety-critical product needs technical leadership they lack.

Pattern:
[Problem] is an important problem... However, SAIF typically looks for teams with strong technical founding leadership given the complexity and competitiveness of building safety-critical AI systems.

### 4. Too Conceptual / Unclear Feasibility
Use when: Ideas are ambitious but lack concrete implementation path.

Pattern:
Your proposal explores ambitious ideas around [topic]. However, the approach as described is highly conceptual, and it's difficult for us to assess a clear technical pathway, feasibility, or near-term product direction.

### 5. Safety Angle Unclear
Use when: Product could relate to safety but connection isn't convincing.

Pattern:
[Company]'s approach to [product] is thoughtful... However, SAIF's focus is on companies building products that directly improve safety and security in the presence of advanced AI systems, and we are not yet convinced that [Company]'s safety impact is sufficiently clear or central to the product.

### 6. Not For-Profit / Wrong Structure
Use when: L3C, non-profit, or no equity path.

Pattern:
SAIF is structured specifically to invest in for-profit companies with scalable business models. As [Company] is [structure], we do not see a clear path for sufficient venture funding to be raised.

### 7. Friendly Rejection with Path Forward
Use when: There's potential but needs specific changes first.

Pattern:
We'd be happy to revisit the conversation in the future, particularly as you [specific ask: bring on cofounder, go full-time, clarify safety angle].

## Closing Wishes

Match the closing to their work:
- Building a company → "building the company"
- Platform → "developing the platform"
- Research/Ideas → "developing your ideas"
- Product → "building and refining the product"
- Programs → "expanding your programs"
- Partnerships → "exploring partnerships"

## Things to Avoid

- Never share internal notes verbatim ("psychosis", "vibe coded", "not believable")
- Never be condescending about their technical abilities
- Never promise to invest in the future
- Never give detailed feedback that could start a debate
- Never use phrases like "at this time" excessively
- Never make the email too long (2-3 paragraphs max)

## Things to Include

- Always acknowledge something positive
- Always be specific about the misfit (without being mean)
- Always end with genuine well wishes
- Offer path forward when genuinely appropriate
- Keep it concise and professional

## Output Format

Output ONLY the email text, nothing else. No explanations, no headers, just the email ready to send.`

// Few-shot examples for better generation
const FEW_SHOT_EXAMPLES = [
  {
    input: {
      company_name: "EmpowerRwanda AI",
      founder_names: "Ishimwe",
      description: "Platform using AI to connect Rwandan youth with digital skills training, apprenticeships, and microenterprise opportunities.",
      internal_notes: ["Not safety"]
    },
    output: `Hi Ishimwe,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that your project fits within the criteria we are using for our fund.

Your work supporting youth skills and employment in Rwanda is meaningful and clearly impactful. However, EmpowerRwanda AI is focused on education, training, and economic opportunity rather than on technologies that directly improve safety and security in the presence of risks created by advanced AI systems. Because of this, the project falls outside the scope of SAIF's investment mandate.

We wish you the best as you continue expanding your programs and building opportunities for young people in Rwanda.

Best,
The SAIF Team`
  },
  {
    input: {
      company_name: "Tova",
      founder_names: null,
      description: "AI safety companion that helps people spot romance and investment scams in real time by analyzing chat flow and showing traffic light warnings.",
      internal_notes: ["No technical founder", "Beta is probably vibe coded"]
    },
    output: `Hi there,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that Tova fits within the criteria we are using for our fund.

Helping users detect scams and risky interactions in real time is an important problem, and we can see the appeal of a product that integrates directly into messaging and financial platforms. However, SAIF typically looks for teams with strong technical founding leadership given the complexity and competitiveness of building safety-critical AI systems. At this stage, and without a technical cofounder driving the core system, we don't believe Tova is the right fit for SAIF's focus.

We wish you the best as you continue developing the product and exploring partnerships.

Best,
The SAIF Team`
  },
  {
    input: {
      company_name: "VAITION",
      founder_names: "Vadim",
      description: "Building the Continuity Layer (L0) with HISPU protocol for human presence verification. Claims to move digital world from probabilistic to deterministic architecture.",
      internal_notes: ["Not believable", "Psychosis"]
    },
    output: `Hi Vadim,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that VAITION fits within the criteria we are using for our fund.

Your proposal explores ambitious ideas around human presence and trust in digital systems. However, the approach as described is highly conceptual, and it's difficult for us to assess a clear technical pathway, feasibility, or near-term product direction. SAIF's focus is on companies building practical, deployable technologies that can be validated and scaled to improve safety and security in real-world AI systems, and VAITION does not currently align with that focus.

We appreciate you reaching out and wish you the best as you continue developing your ideas.

Best,
The SAIF Team`
  },
  {
    input: {
      company_name: "Chord",
      founder_names: "Alex",
      description: "AI-facilitated group communication and decision making tool. Parallelizes group conversations to incorporate more stakeholder thinking.",
      internal_notes: ["Still contracting part time with Anthropic", "Plans on bringing on a co-founder but no short list", "User testing but no market validation yet"]
    },
    output: `Hi Alex,

Thanks very much for expressing interest in being part of SAIF and our efforts to create a better future with AI. Unfortunately at this time we don't think that Chord fits within the criteria we are using for our fund.

Chord's approach to facilitating group communication and decision-making is thoughtful, and we can see how tools like this could be valuable for organizations navigating complex choices. However, SAIF's focus is on companies building products that directly improve safety and security in the presence of advanced AI systems, and we are not yet convinced that Chord's safety impact is sufficiently clear or central to the product. In addition, we typically look for teams with a full-time founder.

We'd be happy to revisit the conversation in the future, particularly as you bring on a cofounder or technical collaborator, transition to full time on the company, and further clarify how Chord's approach meaningfully advances AI safety rather than general decision support.

We wish you the best as you continue building and testing the product.

Best,
The SAIF Team`
  }
]

export async function POST(request: NextRequest) {
  // Verify partner authentication
  const auth = await requirePartnerApi()
  if (!auth.success) {
    return auth.response
  }

  try {
    const { applicationId } = await request.json()

    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 }
      )
    }

    // Fetch application data
    const { data: application, error: appError } = await supabase
      .from('saifcrm_applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found', details: appError?.message },
        { status: 404 }
      )
    }

    // Fetch partner votes/notes for this application
    const { data: votes, error: votesError } = await supabase
      .from('saifcrm_votes')
      .select('vote, notes, saif_people(name)')
      .eq('application_id', applicationId)

    if (votesError) {
      console.error('Error fetching votes:', votesError)
    }

    // Fetch recently edited emails to learn from partner preferences
    // These are emails where the draft differs from the original (partner made edits)
    const { data: editedEmails } = await supabase
      .from('saifcrm_applications')
      .select('company_name, founder_names, company_description, original_draft_email, draft_rejection_email')
      .eq('stage', 'rejected')
      .not('original_draft_email', 'is', null)
      .not('draft_rejection_email', 'is', null)
      .neq('id', applicationId) // Exclude current application
      .order('updated_at', { ascending: false })
      .limit(5)

    // Filter to only include emails that were actually edited
    const partnerEditedExamples = (editedEmails || []).filter(
      (e: any) => e.original_draft_email && e.draft_rejection_email &&
                  e.original_draft_email !== e.draft_rejection_email
    )

    // Build internal notes from partner votes
    const internalNotes: string[] = []
    if (votes && votes.length > 0) {
      votes.forEach((v: any) => {
        if (v.notes) {
          internalNotes.push(v.notes)
        }
      })
    }

    // Fetch deliberation data (idea summary and thoughts)
    const { data: deliberation } = await supabase
      .from('saifcrm_deliberations')
      .select('idea_summary, thoughts')
      .eq('application_id', applicationId)
      .single()

    // Fetch interview notes if rejected from interview stage
    let interviewNotes: string[] = []
    const isInterviewRejection = application.previous_stage === 'interview'

    if (isInterviewRejection && application.company_id) {
      const { data: companyNotes, error: notesError } = await supabase
        .from('saifcrm_company_notes')
        .select('content, meeting_date, saif_people(name)')
        .eq('company_id', application.company_id)
        .order('meeting_date', { ascending: false })
        .limit(10)

      if (notesError) {
        console.error('Error fetching interview notes:', notesError)
      }

      if (companyNotes && companyNotes.length > 0) {
        interviewNotes = companyNotes
          .filter((note: any) => note.content && note.content.trim())
          .map((note: any) => {
            const author = (note.saif_people as { name: string } | null)?.name || 'Unknown'
            const date = note.meeting_date || 'Unknown date'
            return `[${date} - ${author}]: ${note.content}`
          })
      }
    }

    // Build the user message with application details
    let userMessage = `Generate a rejection email for this application:

Company Name: ${application.company_name}
Founder Name(s): ${application.founder_names || 'Unknown'}
Company Description: ${application.company_description || 'No description provided'}
Website: ${application.website || 'Not provided'}
Previous Funding: ${application.previous_funding || 'Not provided'}
Rejection Stage: ${isInterviewRejection ? 'After interviews (they passed initial application review)' : 'Initial application review'}

Internal Notes from Partners (DO NOT share verbatim - use to inform your assessment):
${internalNotes.length > 0 ? internalNotes.map((note) => `- ${note}`).join('\n') : '- No specific notes provided'}`

    // Add deliberation notes if available
    if (deliberation?.idea_summary || deliberation?.thoughts) {
      userMessage += `

Deliberation Summary (DO NOT share verbatim - use to inform your assessment):`
      if (deliberation.idea_summary) {
        userMessage += `
- Idea Summary: ${deliberation.idea_summary}`
      }
      if (deliberation.thoughts) {
        userMessage += `
- Partner Assessment: ${deliberation.thoughts}`
      }
    }

    // Add interview notes if available
    if (interviewNotes.length > 0) {
      userMessage += `

Interview Meeting Notes (DO NOT share verbatim - use to inform your assessment):
${interviewNotes.map((note) => `- ${note}`).join('\n')}`
    }

    userMessage += `

Generate ONLY the email text, nothing else.`

    // Build messages with few-shot examples
    const messages: Anthropic.MessageParam[] = []

    // Add base few-shot examples
    for (const example of FEW_SHOT_EXAMPLES) {
      messages.push({
        role: 'user',
        content: `Generate a rejection email for this application:

Company Name: ${example.input.company_name}
Founder Name(s): ${example.input.founder_names || 'Unknown'}
Company Description: ${example.input.description}

Internal Notes from Partners (DO NOT share verbatim - use to inform your assessment):
${example.input.internal_notes.map(note => `- ${note}`).join('\n')}

Generate ONLY the email text, nothing else.`
      })
      messages.push({
        role: 'assistant',
        content: example.output
      })
    }

    // Add partner-edited examples (these show preferred style after human review)
    // These come after base examples to have more influence
    for (const edited of partnerEditedExamples) {
      messages.push({
        role: 'user',
        content: `Generate a rejection email for this application:

Company Name: ${edited.company_name}
Founder Name(s): ${edited.founder_names || 'Unknown'}
Company Description: ${edited.company_description || 'No description provided'}

Generate ONLY the email text, nothing else.`
      })
      // Use the partner-edited version as the "correct" output
      messages.push({
        role: 'assistant',
        content: edited.draft_rejection_email
      })
    }

    // Add the actual request
    messages.push({
      role: 'user',
      content: userMessage
    })

    // Enhance system prompt if we have partner-edited examples
    let systemPrompt = SYSTEM_PROMPT
    if (partnerEditedExamples.length > 0) {
      systemPrompt += `\n\n## Partner Preferences\n\nNote: The examples include emails that have been reviewed and edited by SAIF partners. Pay attention to their preferred tone, length, and style adjustments.`
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    })

    // Extract the email text from response
    const emailContent = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // Save the generated email to BOTH columns
    // original_draft_email preserves the AI's original for comparison
    // draft_rejection_email is what partners will edit
    const { error: updateError } = await supabase
      .from('saifcrm_applications')
      .update({
        draft_rejection_email: emailContent,
        original_draft_email: emailContent
      })
      .eq('id', applicationId)

    if (updateError) {
      console.error('Error saving draft email:', updateError)
      // Still return the email even if save fails
    }

    return NextResponse.json({
      success: true,
      email: emailContent,
      applicationId: applicationId,
      learnedFromEdits: partnerEditedExamples.length
    })

  } catch (error: any) {
    console.error('Error generating rejection email:', error)
    return NextResponse.json(
      { error: 'Failed to generate rejection email', details: error.message },
      { status: 500 }
    )
  }
}

// Endpoint to save edited email
export async function PUT(request: NextRequest) {
  // Verify partner authentication
  const auth = await requirePartnerApi()
  if (!auth.success) {
    return auth.response
  }

  try {
    const { applicationId, email } = await request.json()

    if (!applicationId || !email) {
      return NextResponse.json(
        { error: 'applicationId and email are required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('saifcrm_applications')
      .update({ draft_rejection_email: email })
      .eq('id', applicationId)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save email', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email saved successfully'
    })

  } catch (error: any) {
    console.error('Error saving email:', error)
    return NextResponse.json(
      { error: 'Failed to save email', details: error.message },
      { status: 500 }
    )
  }
}
