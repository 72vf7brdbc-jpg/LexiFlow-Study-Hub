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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          cloze: string | null
          collocations: string[]
          correct_count: number
          created_at: string
          definition: string | null
          due_at: string
          ease: number
          example: string | null
          id: string
          incorrect_count: number
          interval_days: number
          kind: string
          last_reviewed_at: string | null
          material_id: string | null
          meaning: string
          phonetic: string | null
          repetitions: number
          synonyms: string[]
          term: string
          user_id: string
        }
        Insert: {
          cloze?: string | null
          collocations?: string[]
          correct_count?: number
          created_at?: string
          definition?: string | null
          due_at?: string
          ease?: number
          example?: string | null
          id?: string
          incorrect_count?: number
          interval_days?: number
          kind?: string
          last_reviewed_at?: string | null
          material_id?: string | null
          meaning: string
          phonetic?: string | null
          repetitions?: number
          synonyms?: string[]
          term: string
          user_id: string
        }
        Update: {
          cloze?: string | null
          collocations?: string[]
          correct_count?: number
          created_at?: string
          definition?: string | null
          due_at?: string
          ease?: number
          example?: string | null
          id?: string
          incorrect_count?: number
          interval_days?: number
          kind?: string
          last_reviewed_at?: string | null
          material_id?: string | null
          meaning?: string
          phonetic?: string | null
          repetitions?: number
          synonyms?: string[]
          term?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          activities: string[]
          card_count: number
          created_at: string
          enriched_at: string | null
          extracted_text: string | null
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          id: string
          lesson_date: string | null
          notes: string | null
          source_type: string
          summary: string | null
          title: string
          topic: string | null
          topics: string | null
          updated_at: string
          user_id: string
          vocabulary_notes: string | null
        }
        Insert: {
          activities?: string[]
          card_count?: number
          created_at?: string
          enriched_at?: string | null
          extracted_text?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          lesson_date?: string | null
          notes?: string | null
          source_type: string
          summary?: string | null
          title: string
          topic?: string | null
          topics?: string | null
          updated_at?: string
          user_id: string
          vocabulary_notes?: string | null
        }
        Update: {
          activities?: string[]
          card_count?: number
          created_at?: string
          enriched_at?: string | null
          extracted_text?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          lesson_date?: string | null
          notes?: string | null
          source_type?: string
          summary?: string | null
          title?: string
          topic?: string | null
          topics?: string | null
          updated_at?: string
          user_id?: string
          vocabulary_notes?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cefr_level: string | null
          created_at: string
          days_per_week: number | null
          display_name: string | null
          goal: string | null
          id: string
          last_study_date: string | null
          lesson_days: number[]
          longest_streak: number
          native_language: string | null
          onboarded: boolean
          streak: number
          updated_at: string
          xp: number
        }
        Insert: {
          cefr_level?: string | null
          created_at?: string
          days_per_week?: number | null
          display_name?: string | null
          goal?: string | null
          id: string
          last_study_date?: string | null
          lesson_days?: number[]
          longest_streak?: number
          native_language?: string | null
          onboarded?: boolean
          streak?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          cefr_level?: string | null
          created_at?: string
          days_per_week?: number | null
          display_name?: string | null
          goal?: string | null
          id?: string
          last_study_date?: string | null
          lesson_days?: number[]
          longest_streak?: number
          native_language?: string | null
          onboarded?: boolean
          streak?: number
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          answer: string | null
          card_id: string | null
          correct: boolean
          created_at: string
          exercise: string
          id: string
          mode: string
          user_id: string
          xp: number
        }
        Insert: {
          answer?: string | null
          card_id?: string | null
          correct: boolean
          created_at?: string
          exercise?: string
          id?: string
          mode?: string
          user_id: string
          xp?: number
        }
        Update: {
          answer?: string | null
          card_id?: string | null
          correct?: boolean
          created_at?: string
          exercise?: string
          id?: string
          mode?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_on: string
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          exercise_ref: string | null
          id: string
          linked_file: boolean
          material_id: string
          source_text: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_on?: string
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          exercise_ref?: string | null
          id?: string
          linked_file?: boolean
          material_id: string
          source_text?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_on?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          exercise_ref?: string | null
          id?: string
          linked_file?: boolean
          material_id?: string
          source_text?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
