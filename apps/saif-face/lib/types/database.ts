export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'partner' | 'founder' | 'advisor' | 'employee' | 'board_member' | 'investor' | 'contact'
export type UserStatus = 'active' | 'pending' | 'tracked' | 'inactive'
export type CompanyStage = 'portfolio' | 'prospect' | 'diligence' | 'passed' | 'archived'
export type RelationshipType = 'founder' | 'employee' | 'advisor' | 'board_member'

export interface Database {
  public: {
    Tables: {
      saif_people: {
        Row: {
          id: string
          auth_user_id: string | null
          email: string | null
          role: UserRole
          status: UserStatus
          first_name: string | null
          last_name: string | null
          title: string | null
          bio: string | null
          avatar_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          mobile_phone: string | null
          location: string | null
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
          title?: string | null
          bio?: string | null
          avatar_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          mobile_phone?: string | null
          location?: string | null
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
          title?: string | null
          bio?: string | null
          avatar_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          mobile_phone?: string | null
          location?: string | null
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

// Helper types for working with people
export type Person = Database['public']['Tables']['saif_people']['Row']
export type Company = Database['public']['Tables']['saif_companies']['Row']
export type CompanyPerson = Database['public']['Tables']['saif_company_people']['Row']
export type Investment = Database['public']['Tables']['saif_investments']['Row']

// Helper type for person with company info
export type PersonWithCompany = Person & {
  companies?: (CompanyPerson & {
    company: Company
  })[]
}

// Helper type for company with people
export type CompanyWithPeople = Company & {
  people?: (CompanyPerson & {
    person: Person
  })[]
}
