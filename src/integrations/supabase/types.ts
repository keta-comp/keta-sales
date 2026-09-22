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
      activities: {
        Row: {
          action: string
          actor: string
          actor_user_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          detail: string | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor?: string
          actor_user_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          actor_user_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          detail?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          business_id: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          escalation_rules: string
          id: string
          language_instruction: string
          max_discount_percent: number
          model: string
          sales_strategy: string
          tone_of_voice: string
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          escalation_rules?: string
          id?: string
          language_instruction?: string
          max_discount_percent?: number
          model?: string
          sales_strategy?: string
          tone_of_voice?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          escalation_rules?: string
          id?: string
          language_instruction?: string
          max_discount_percent?: number
          model?: string
          sales_strategy?: string
          tone_of_voice?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          business_id: string | null
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string | null
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_kind: string
          actor_user_id: string | null
          business_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          status: string
          target_id: string | null
          target_label: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_kind?: string
          actor_user_id?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          status?: string
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_kind?: string
          actor_user_id?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          status?: string
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          business_description: string
          business_id: string
          business_name: string
          created_at: string
          currency: string
          delivery_info: string
          id: string
          operator_group_chat_id: string | null
          payment_methods: string
          return_policy: string
          updated_at: string
          working_hours: string
        }
        Insert: {
          business_description?: string
          business_id?: string
          business_name?: string
          created_at?: string
          currency?: string
          delivery_info?: string
          id?: string
          operator_group_chat_id?: string | null
          payment_methods?: string
          return_policy?: string
          updated_at?: string
          working_hours?: string
        }
        Update: {
          business_description?: string
          business_id?: string
          business_name?: string
          created_at?: string
          currency?: string
          delivery_info?: string
          id?: string
          operator_group_chat_id?: string | null
          payment_methods?: string
          return_policy?: string
          updated_at?: string
          working_hours?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          status: string
          suspend_reason: string | null
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          plan?: string
          status?: string
          suspend_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          status?: string
          suspend_reason?: string | null
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_operator_id: string | null
          business_id: string
          channel: string
          created_at: string
          customer_id: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          mode: Database["public"]["Enums"]["conversation_mode"]
          telegram_chat_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_operator_id?: string | null
          business_id?: string
          channel?: string
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          mode?: Database["public"]["Enums"]["conversation_mode"]
          telegram_chat_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_operator_id?: string | null
          business_id?: string
          channel?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          mode?: Database["public"]["Enums"]["conversation_mode"]
          telegram_chat_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_configs: {
        Row: {
          business_description: string | null
          business_id: string
          config: Json
          created_at: string
          id: string
          industry: string
          updated_at: string
        }
        Insert: {
          business_description?: string | null
          business_id: string
          config?: Json
          created_at?: string
          id?: string
          industry: string
          updated_at?: string
        }
        Update: {
          business_description?: string | null
          business_id?: string
          config?: Json
          created_at?: string
          id?: string
          industry?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_records: {
        Row: {
          business_id: string
          created_at: string
          data: Json
          id: string
          module_key: string
          stage: string | null
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          data?: Json
          id?: string
          module_key: string
          stage?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          data?: Json
          id?: string
          module_key?: string
          stage?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          assigned_operator_id: string | null
          business_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram_user_id: string | null
          last_contact_at: string | null
          last_interaction_at: string
          location: string | null
          notes: string | null
          phone: string | null
          source: string
          status: string
          telegram_user_id: string | null
          telegram_username: string | null
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          assigned_operator_id?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_user_id?: string | null
          last_contact_at?: string | null
          last_interaction_at?: string
          location?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          telegram_user_id?: string | null
          telegram_username?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          assigned_operator_id?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_user_id?: string | null
          last_contact_at?: string | null
          last_interaction_at?: string
          location?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          telegram_user_id?: string | null
          telegram_username?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          key: string
          label: string
          target_business_id: string | null
          target_plan: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          key: string
          label: string
          target_business_id?: string | null
          target_plan?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          key?: string
          label?: string
          target_business_id?: string | null
          target_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_target_business_id_fkey"
            columns: ["target_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_events: {
        Row: {
          created_at: string
          mid: string
          payload: Json
        }
        Insert: {
          created_at?: string
          mid: string
          payload?: Json
        }
        Update: {
          created_at?: string
          mid?: string
          payload?: Json
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          business_id: string
          change: number
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          reason: string
          reference_id: string | null
        }
        Insert: {
          business_id?: string
          change: number
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          reason: string
          reference_id?: string | null
        }
        Update: {
          business_id?: string
          change?: number
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          reason?: string
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          actor: string
          business_id: string
          created_at: string
          detail: string | null
          event_type: string
          id: string
          lead_id: string
        }
        Insert: {
          actor?: string
          business_id?: string
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          lead_id: string
        }
        Update: {
          actor?: string
          business_id?: string
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_summary: string | null
          assigned_operator_id: string | null
          budget: string | null
          business_id: string
          conversation_id: string | null
          created_at: string
          customer_id: string
          handoff_reason: string | null
          id: string
          last_contact_at: string | null
          location: string | null
          next_action: string | null
          notes: string | null
          phone: string | null
          product_id: string | null
          requested_product: string | null
          score: Database["public"]["Enums"]["lead_score"]
          source: string
          stage: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value: number
        }
        Insert: {
          ai_summary?: string | null
          assigned_operator_id?: string | null
          budget?: string | null
          business_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_id: string
          handoff_reason?: string | null
          id?: string
          last_contact_at?: string | null
          location?: string | null
          next_action?: string | null
          notes?: string | null
          phone?: string | null
          product_id?: string | null
          requested_product?: string | null
          score?: Database["public"]["Enums"]["lead_score"]
          source?: string
          stage?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          ai_summary?: string | null
          assigned_operator_id?: string | null
          budget?: string | null
          business_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_id?: string
          handoff_reason?: string | null
          id?: string
          last_contact_at?: string | null
          location?: string | null
          next_action?: string | null
          notes?: string | null
          phone?: string | null
          product_id?: string | null
          requested_product?: string | null
          score?: Database["public"]["Enums"]["lead_score"]
          source?: string
          stage?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          business_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          operator_id: string | null
          role: Database["public"]["Enums"]["message_role"]
          telegram_message_id: number | null
        }
        Insert: {
          business_id?: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          operator_id?: string | null
          role: Database["public"]["Enums"]["message_role"]
          telegram_message_id?: number | null
        }
        Update: {
          business_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          operator_id?: string | null
          role?: Database["public"]["Enums"]["message_role"]
          telegram_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          business_id: string
          id: string
          lead_id: string
          operator_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          business_id?: string
          id?: string
          lead_id: string
          operator_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          business_id?: string
          id?: string
          lead_id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          business_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          telegram_user_id: string | null
          telegram_username: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id?: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operators_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          business_id: string
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          unit_price: number
        }
        Insert: {
          business_id?: string
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          unit_price?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_operator_id: string | null
          business_id: string
          conversation_id: string | null
          created_at: string
          customer_id: string
          delivery_address: string | null
          discount: number
          id: string
          lead_id: string | null
          notes: string | null
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_applied: boolean
          total: number
          updated_at: string
        }
        Insert: {
          assigned_operator_id?: string | null
          business_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_id: string
          delivery_address?: string | null
          discount?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_applied?: boolean
          total?: number
          updated_at?: string
        }
        Update: {
          assigned_operator_id?: string | null
          business_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: string | null
          discount?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_applied?: boolean
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          method: string
          note: string | null
          order_id: string | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          method?: string
          note?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          method?: string
          note?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          business_id: string
          category_id: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          description: string
          id: string
          images: Json
          is_active: boolean
          is_archived: boolean
          low_stock_threshold: number
          name: string
          price: number
          reserved_quantity: number
          sku: string
          specifications: Json
          stock_quantity: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          business_id?: string
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          images?: Json
          is_active?: boolean
          is_archived?: boolean
          low_stock_threshold?: number
          name: string
          price?: number
          reserved_quantity?: number
          sku: string
          specifications?: Json
          stock_quantity?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_id?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          images?: Json
          is_active?: boolean
          is_archived?: boolean
          low_stock_threshold?: number
          name?: string
          price?: number
          reserved_quantity?: number
          sku?: string
          specifications?: Json
          stock_quantity?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_active_at: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_active_at?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          target_kind: string
          target_value: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          target_kind?: string
          target_value?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          target_kind?: string
          target_value?: string | null
          title?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          default_currency: string
          default_timezone: string
          id: string
          maintenance_message: string | null
          maintenance_mode: boolean
          platform_name: string
          support_email: string
          support_phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          default_timezone?: string
          id?: string
          maintenance_message?: string | null
          maintenance_mode?: boolean
          platform_name?: string
          support_email?: string
          support_phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_timezone?: string
          id?: string
          maintenance_message?: string | null
          maintenance_mode?: boolean
          platform_name?: string
          support_email?: string
          support_phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_operator_id: string | null
          business_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          order_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_operator_id?: string | null
          business_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          order_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_operator_id?: string | null
          business_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          order_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_requests: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          telegram_chat_id: string
          telegram_user_id: string
          telegram_username: string | null
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          telegram_chat_id: string
          telegram_user_id: string
          telegram_username?: string | null
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          telegram_chat_id?: string
          telegram_user_id?: string
          telegram_username?: string | null
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          business_id: string
          created_at: string
          daily_reports: boolean
          id: string
          last_report_date: string | null
          linked_at: string
          notify_lead: boolean
          notify_low_stock: boolean
          notify_new_order: boolean
          notify_payment: boolean
          report_time: string
          status: string
          telegram_chat_id: string
          telegram_user_id: string
          telegram_username: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          daily_reports?: boolean
          id?: string
          last_report_date?: string | null
          linked_at?: string
          notify_lead?: boolean
          notify_low_stock?: boolean
          notify_new_order?: boolean
          notify_payment?: boolean
          report_time?: string
          status?: string
          telegram_chat_id: string
          telegram_user_id: string
          telegram_username?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          daily_reports?: boolean
          id?: string
          last_report_date?: string | null
          linked_at?: string
          notify_lead?: boolean
          notify_low_stock?: boolean
          notify_new_order?: boolean
          notify_payment?: boolean
          report_time?: string
          status?: string
          telegram_chat_id?: string
          telegram_user_id?: string
          telegram_username?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          business_id: string
          created_at: string
          payload: Json
          update_id: number
        }
        Insert: {
          business_id: string
          created_at?: string
          payload: Json
          update_id: number
        }
        Update: {
          business_id?: string
          created_at?: string
          payload?: Json
          update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_updates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      apply_order_stock: {
        Args: { _actor?: string; _order_id: string }
        Returns: undefined
      }
      current_business_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      my_access_state: { Args: never; Returns: Json }
      my_workspace_status: { Args: never; Returns: string }
      platform_stats: { Args: never; Returns: Json }
      revert_order_stock: {
        Args: { _actor?: string; _order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "owner" | "manager"
      conversation_mode: "ai" | "human"
      lead_score: "hot" | "warm" | "cold"
      lead_status:
        | "new"
        | "needs_operator"
        | "assigned"
        | "contacted"
        | "negotiating"
        | "won"
        | "lost"
      message_role: "customer" | "ai" | "operator" | "system"
      order_status:
        | "new"
        | "confirming"
        | "confirmed"
        | "preparing"
        | "delivered"
        | "cancelled"
      payment_status: "unpaid" | "partial" | "paid" | "refunded"
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
    Enums: {
      app_role: ["admin", "operator", "owner", "manager"],
      conversation_mode: ["ai", "human"],
      lead_score: ["hot", "warm", "cold"],
      lead_status: [
        "new",
        "needs_operator",
        "assigned",
        "contacted",
        "negotiating",
        "won",
        "lost",
      ],
      message_role: ["customer", "ai", "operator", "system"],
      order_status: [
        "new",
        "confirming",
        "confirmed",
        "preparing",
        "delivered",
        "cancelled",
      ],
      payment_status: ["unpaid", "partial", "paid", "refunded"],
    },
  },
} as const
