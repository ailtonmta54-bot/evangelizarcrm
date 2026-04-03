export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          active: boolean
          agent_type: Database["public"]["Enums"]["agent_type"]
          avatar_url: string | null
          away_message: string | null
          company_id: string
          created_at: string
          description: string
          elevenlabs_enabled: boolean | null
          elevenlabs_voice_id: string | null
          goal: string
          google_calendar_enabled: boolean | null
          google_calendar_id: string | null
          google_calendar_link: string | null
          id: string
          ignore_groups: boolean | null
          ignore_video_calls: boolean | null
          ignore_voice_calls: boolean | null
          is_default: boolean
          keywords: string | null
          knowledge: string
          name: string
          prompt: string
          recognize_audio: boolean | null
          schedule_days: string | null
          schedule_enabled: boolean | null
          schedule_end: string | null
          schedule_start: string | null
          status: string | null
          temperature: number
          tone: string
          updated_at: string
          whatsapp_phone_id: string | null
          whatsapp_token: string | null
          whatsapp_verify_token: string | null
        }
        Insert: {
          active?: boolean
          agent_type?: Database["public"]["Enums"]["agent_type"]
          avatar_url?: string | null
          away_message?: string | null
          company_id: string
          created_at?: string
          description?: string
          elevenlabs_enabled?: boolean | null
          elevenlabs_voice_id?: string | null
          goal?: string
          google_calendar_enabled?: boolean | null
          google_calendar_id?: string | null
          google_calendar_link?: string | null
          id?: string
          ignore_groups?: boolean | null
          ignore_video_calls?: boolean | null
          ignore_voice_calls?: boolean | null
          is_default?: boolean
          keywords?: string | null
          knowledge?: string
          name: string
          prompt?: string
          recognize_audio?: boolean | null
          schedule_days?: string | null
          schedule_enabled?: boolean | null
          schedule_end?: string | null
          schedule_start?: string | null
          status?: string | null
          temperature?: number
          tone?: string
          updated_at?: string
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
          whatsapp_verify_token?: string | null
        }
        Update: {
          active?: boolean
          agent_type?: Database["public"]["Enums"]["agent_type"]
          avatar_url?: string | null
          away_message?: string | null
          company_id?: string
          created_at?: string
          description?: string
          elevenlabs_enabled?: boolean | null
          elevenlabs_voice_id?: string | null
          goal?: string
          google_calendar_enabled?: boolean | null
          google_calendar_id?: string | null
          google_calendar_link?: string | null
          id?: string
          ignore_groups?: boolean | null
          ignore_video_calls?: boolean | null
          ignore_voice_calls?: boolean | null
          is_default?: boolean
          keywords?: string | null
          knowledge?: string
          name?: string
          prompt?: string
          recognize_audio?: boolean | null
          schedule_days?: string | null
          schedule_enabled?: boolean | null
          schedule_end?: string | null
          schedule_start?: string | null
          status?: string | null
          temperature?: number
          tone?: string
          updated_at?: string
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
          whatsapp_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_id: string
          company_id: string
          created_at: string
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          automation_id: string
          company_id: string
          created_at?: string
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          automation_id?: string
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          delay_hours: number
          id: string
          message: string
          name: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          delay_hours?: number
          id?: string
          message?: string
          name: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          delay_hours?: number
          id?: string
          message?: string
          name?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          openai_api_key: string | null
          updated_at: string
          whatsapp_phone_id: string | null
          whatsapp_token: string | null
          whatsapp_verify_token: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          openai_api_key?: string | null
          updated_at?: string
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
          whatsapp_verify_token?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          openai_api_key?: string | null
          updated_at?: string
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
          whatsapp_verify_token?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          agent_id: string | null
          ai_enabled: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          phone: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          ai_enabled?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          ai_enabled?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          lead_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          lead_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          lead_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          external_link: string | null
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          external_link?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          external_link?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_config: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          goal: string
          id: string
          prompt: string
          temperature: number
          tone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          goal?: string
          id?: string
          prompt?: string
          temperature?: number
          tone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          goal?: string
          id?: string
          prompt?: string
          temperature?: number
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agent_type:
        | "vendas"
        | "atendimento"
        | "suporte"
        | "qualificacao"
        | "agendamento"
        | "custom"
      app_role: "admin" | "user"
      lead_status: "novo" | "atendimento" | "proposta" | "fechado"
      message_type: "enviada" | "recebida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_type: [
        "vendas",
        "atendimento",
        "suporte",
        "qualificacao",
        "agendamento",
        "custom",
      ],
      app_role: ["admin", "user"],
      lead_status: ["novo", "atendimento", "proposta", "fechado"],
      message_type: ["enviada", "recebida"],
    },
  },
} as const
