export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Shared enums
export type UserRole = 'partner' | 'founder' | 'advisor' | 'employee' | 'board_member' | 'investor' | 'contact'
export type UserStatus = 'active' | 'pending' | 'tracked' | 'inactive'
export type CompanyStage = 'portfolio' | 'prospect' | 'diligence' | 'passed' | 'archived' | 'saif'
export type RelationshipType = 'founder' | 'employee' | 'advisor' | 'board_member' | 'partner'

// CRM-specific enums
export type ApplicationStage = 'new' | 'voting' | 'deliberation' | 'invested' | 'rejected'
export type VoteType = 'initial' | 'final'
export type DeliberationDecision = 'pending' | 'maybe' | 'yes' | 'no'

export interface Database {
  public: {
    Tables: {
      // ========================================
      // SHARED TABLES (used by both apps)
      // ========================================
      saif_people: {
        Row: {
          id: string
          auth_user_id: string | null
          email: string | null
          role: UserRole
          status: UserStatus
          first_name: string | null
          last_name: string | null
          name: string | null // CRM uses 'name' field
          title: string | null
          bio: string | null
          avatar_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          mobile_phone: string | null
          location: string | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          email?: string | null
          role: UserRole
          status?: UserStatus
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          title?: string | null
          bio?: string | null
          avatar_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          mobile_phone?: string | null
          location?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          email?: string | null
          role?: UserRole
          status?: UserStatus
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          title?: string | null
          bio?: string | null
          avatar_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          mobile_phone?: string | null
          location?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      saif_companies: {
        Row: {
          id: string
          name: string
          previous_names: string[] | null
          short_description: string | null
          website: string | null
          logo_url: string | null
          industry: string | null
          founded_year: number | null
          is_aisafety_company: boolean
          yc_batch: string | null
          city: string | null
          country: string | null
          stage: CompanyStage
          is_active: boolean
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          previous_names?: string[] | null
          short_description?: string | null
          website?: string | null
          logo_url?: string | null
          industry?: string | null
          founded_year?: number | null
          is_aisafety_company?: boolean
          yc_batch?: string | null
          city?: string | null
          country?: string | null
          stage?: CompanyStage
          is_active?: boolean
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          previous_names?: string[] | null
          short_description?: string | null
          website?: string | null
          logo_url?: string | null
          industry?: string | null
          founded_year?: number | null
          is_aisafety_company?: boolean
          yc_batch?: string | null
          city?: string | null
          country?: string | null
          stage?: CompanyStage
          is_active?: boolean
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      saif_company_people: {
        Row: {
          id: string
          company_id: string
          user_id: string
          relationship_type: RelationshipType
          title: string | null
          is_primary_contact: boolean
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          relationship_type: RelationshipType
          title?: string | null
          is_primary_contact?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          relationship_type?: RelationshipType
          title?: string | null
          is_primary_contact?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saif_company_people_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "saif_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saif_company_people_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }
      saif_investments: {
        Row: {
          id: string
          company_id: string
          investment_date: string
          type: string | null
          amount: number
          round: string | null
          post_money_valuation: number | null
          discount: number | null
          shares: number | null
          common_shares: number | null
          preferred_shares: number | null
          FD_shares: number | null
          share_location: string | null
          share_cert_numbers: string[] | null
          lead_partner_id: string | null
          status: string
          exit_date: string | null
          acquirer: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          investment_date: string
          type?: string | null
          amount: number
          round?: string | null
          post_money_valuation?: number | null
          discount?: number | null
          shares?: number | null
          common_shares?: number | null
          preferred_shares?: number | null
          FD_shares?: number | null
          share_location?: string | null
          share_cert_numbers?: string[] | null
          lead_partner_id?: string | null
          status?: string
          exit_date?: string | null
          acquirer?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          investment_date?: string
          type?: string | null
          amount?: number
          round?: string | null
          post_money_valuation?: number | null
          discount?: number | null
          shares?: number | null
          common_shares?: number | null
          preferred_shares?: number | null
          FD_shares?: number | null
          share_location?: string | null
          share_cert_numbers?: string[] | null
          lead_partner_id?: string | null
          status?: string
          exit_date?: string | null
          acquirer?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saif_investments_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "saif_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saif_investments_lead_partner_id_fkey"
            columns: ["lead_partner_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }

      // ========================================
      // CRM-SPECIFIC TABLES
      // ========================================
      saifcrm_applications: {
        Row: {
          id: string
          company_name: string
          founder_names: string | null
          founder_linkedins: string | null
          founder_bios: string | null
          primary_email: string | null
          company_description: string | null
          website: string | null
          previous_funding: string | null
          deck_link: string | null
          stage: ApplicationStage
          email_sender_id: string | null
          email_sent: boolean
          votes_revealed: boolean
          submitted_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          founder_names?: string | null
          founder_linkedins?: string | null
          founder_bios?: string | null
          primary_email?: string | null
          company_description?: string | null
          website?: string | null
          previous_funding?: string | null
          deck_link?: string | null
          stage?: ApplicationStage
          email_sender_id?: string | null
          email_sent?: boolean
          votes_revealed?: boolean
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          founder_names?: string | null
          founder_linkedins?: string | null
          founder_bios?: string | null
          primary_email?: string | null
          company_description?: string | null
          website?: string | null
          previous_funding?: string | null
          deck_link?: string | null
          stage?: ApplicationStage
          email_sender_id?: string | null
          email_sent?: boolean
          votes_revealed?: boolean
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saifcrm_applications_email_sender_id_fkey"
            columns: ["email_sender_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }
      saifcrm_votes: {
        Row: {
          id: string
          application_id: string
          user_id: string
          vote_type: VoteType
          vote: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          user_id: string
          vote_type?: VoteType
          vote?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          user_id?: string
          vote_type?: VoteType
          vote?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saifcrm_votes_application_id_fkey"
            columns: ["application_id"]
            referencedRelation: "saifcrm_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saifcrm_votes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }
      saifcrm_deliberations: {
        Row: {
          id: string
          application_id: string
          decision: DeliberationDecision
          status: string | null
          notes: string | null
          meeting_date: string | null
          idea_summary: string | null
          thoughts: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          decision?: DeliberationDecision
          status?: string | null
          notes?: string | null
          meeting_date?: string | null
          idea_summary?: string | null
          thoughts?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          decision?: DeliberationDecision
          status?: string | null
          notes?: string | null
          meeting_date?: string | null
          idea_summary?: string | null
          thoughts?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saifcrm_deliberations_application_id_fkey"
            columns: ["application_id"]
            referencedRelation: "saifcrm_applications"
            referencedColumns: ["id"]
          }
        ]
      }
      saifcrm_investments: {
        Row: {
          id: string
          company_name: string
          founders: string | null
          description: string | null
          website: string | null
          amount: number | null
          investment_date: string | null
          terms: string | null
          other_funders: string | null
          contact_name: string | null
          contact_email: string | null
          notes: string | null
          stealthy: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          founders?: string | null
          description?: string | null
          website?: string | null
          amount?: number | null
          investment_date?: string | null
          terms?: string | null
          other_funders?: string | null
          contact_name?: string | null
          contact_email?: string | null
          notes?: string | null
          stealthy?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          founders?: string | null
          description?: string | null
          website?: string | null
          amount?: number | null
          investment_date?: string | null
          terms?: string | null
          other_funders?: string | null
          contact_name?: string | null
          contact_email?: string | null
          notes?: string | null
          stealthy?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      saifcrm_meeting_notes: {
        Row: {
          id: string
          application_id: string
          user_id: string
          content: string
          meeting_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          application_id: string
          user_id: string
          content: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          user_id?: string
          content?: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saifcrm_meeting_notes_application_id_fkey"
            columns: ["application_id"]
            referencedRelation: "saifcrm_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saifcrm_meeting_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }
      saifcrm_investment_notes: {
        Row: {
          id: string
          investment_id: string
          user_id: string
          content: string
          meeting_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          investment_id: string
          user_id: string
          content: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          investment_id?: string
          user_id?: string
          content?: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saifcrm_investment_notes_investment_id_fkey"
            columns: ["investment_id"]
            referencedRelation: "saifcrm_investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saifcrm_investment_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }
      saifcrm_people_notes: {
        Row: {
          id: string
          person_id: string
          user_id: string
          content: string
          meeting_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          person_id: string
          user_id: string
          content: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          user_id?: string
          content?: string
          meeting_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saifcrm_people_notes_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saifcrm_people_notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "saif_people"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: UserRole
      }
      is_partner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_founder: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_person_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ========================================
// HELPER TYPES
// ========================================

// Shared types
export type Person = Database['public']['Tables']['saif_people']['Row']
export type Company = Database['public']['Tables']['saif_companies']['Row']
export type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']
export type Investment = Database['public']['Tables']['saif_investments']['Row']

// CRM types
export type Application = Database['public']['Tables']['saifcrm_applications']['Row']
export type Vote = Database['public']['Tables']['saifcrm_votes']['Row']
export type Deliberation = Database['public']['Tables']['saifcrm_deliberations']['Row']
export type CrmInvestment = Database['public']['Tables']['saifcrm_investments']['Row']
export type InvestmentNote = Database['public']['Tables']['saifcrm_investment_notes']['Row']
export type PeopleNote = Database['public']['Tables']['saifcrm_people_notes']['Row']

// Composite types
export type PersonWithCompany = Person & {
  companies?: (CompanyPerson & {
    company: Company
  })[]
}

export type CompanyWithPeople = Company & {
  people?: (CompanyPerson & {
    person: Person
  })[]
}

export type ApplicationWithVotes = Application & {
  saifcrm_votes?: Vote[]
  saifcrm_deliberations?: Deliberation[]
  saif_people?: Person
}
