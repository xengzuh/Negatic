export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bot_sessions: {
        Row: {
          created_at: string
          draft: Json
          expires_at: string
          restaurant_id: string
          state: Database["public"]["Enums"]["bot_session_state"]
          updated_at: string
          wa_id: string
        }
        Insert: {
          created_at?: string
          draft?: Json
          expires_at?: string
          restaurant_id: string
          state: Database["public"]["Enums"]["bot_session_state"]
          updated_at?: string
          wa_id: string
        }
        Update: {
          created_at?: string
          draft?: Json
          expires_at?: string
          restaurant_id?: string
          state?: Database["public"]["Enums"]["bot_session_state"]
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          available_quantity: number
          created_at: string
          min_order_quantity: number
          price_per_unit_cents: number
          product_id: string
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          created_at?: string
          min_order_quantity?: number
          price_per_unit_cents: number
          product_id: string
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          created_at?: string
          min_order_quantity?: number
          price_per_unit_cents?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_cents: number
          order_id: string
          product_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_cents: number
          order_id: string
          product_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_cents?: number
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
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
          created_at: string
          deleted_at: string | null
          delivery_date: string
          delivery_window: string | null
          id: string
          idempotency_key: string
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          supplier_id: string
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          delivery_date: string
          delivery_window?: string | null
          id?: string
          idempotency_key: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id: string
          total_amount_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string
          delivery_window?: string | null
          id?: string
          idempotency_key?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id?: string
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          halal_certified: boolean
          id: string
          name: string
          name_ms: string | null
          sku: string
          supplier_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          halal_certified?: boolean
          id?: string
          name: string
          name_ms?: string | null
          sku: string
          supplier_id: string
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          halal_certified?: boolean
          id?: string
          name?: string
          name_ms?: string | null
          sku?: string
          supplier_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          default_payment_method: string | null
          deleted_at: string | null
          delivery_zone: string | null
          id: string
          name: string
          phone: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_payment_method?: string | null
          deleted_at?: string | null
          delivery_zone?: string | null
          id?: string
          name: string
          phone: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          default_payment_method?: string | null
          deleted_at?: string | null
          delivery_zone?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          business_registration: string | null
          created_at: string
          deleted_at: string | null
          delivery_zones: string[]
          halal_cert_number: string | null
          id: string
          name: string
          payment_terms: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_registration?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_zones?: string[]
          halal_cert_number?: string | null
          id?: string
          name: string
          payment_terms?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_registration?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_zones?: string[]
          halal_cert_number?: string | null
          id?: string
          name?: string
          payment_terms?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          event_types: Json
          id: string
          secret: string
          supplier_id: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_types?: Json
          id?: string
          secret: string
          supplier_id: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_types?: Json
          id?: string
          secret?: string
          supplier_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      bot_session_state:
        | "choosing_product"
        | "choosing_quantity"
        | "choosing_date"
        | "confirming"
      order_status: "pending" | "confirmed" | "fulfilled" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

