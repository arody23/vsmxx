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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ambassador_applications: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: number
          main_platform: string
          motivation: string
          phone: string
          profile_url: string | null
          status: string
          username: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: number
          main_platform: string
          motivation: string
          phone: string
          profile_url?: string | null
          status?: string
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: number
          main_platform?: string
          motivation?: string
          phone?: string
          profile_url?: string | null
          status?: string
          username?: string
        }
        Relationships: []
      }
      ambassador_clicks: {
        Row: {
          clicked_at: string | null
          id: number
          link_id: number
          product_id: number | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          id?: number
          link_id: number
          product_id?: number | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          id?: number
          link_id?: number
          product_id?: number | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "ambassador_links"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_links: {
        Row: {
          active: boolean
          ambassador_id: string
          created_at: string | null
          id: number
          promo_code_id: number | null
          slug: string
          target_product_id: number | null
          target_type: string
        }
        Insert: {
          active?: boolean
          ambassador_id: string
          created_at?: string | null
          id?: number
          promo_code_id?: number | null
          slug: string
          target_product_id?: number | null
          target_type: string
        }
        Update: {
          active?: boolean
          ambassador_id?: string
          created_at?: string | null
          id?: number
          promo_code_id?: number | null
          slug?: string
          target_product_id?: number | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_links_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_links_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          city: string | null
          id: number
          is_active: boolean
          name: string
          price: number | null
        }
        Insert: {
          city?: string | null
          id?: number
          is_active?: boolean
          name: string
          price?: number | null
        }
        Update: {
          city?: string | null
          id?: number
          is_active?: boolean
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string | null
          id: number
          order_id: number
          product_id: number | null
          product_name: string
          quantity: number
          size: string | null
          unit_price: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: never
          order_id: number
          product_id?: number | null
          product_name: string
          quantity?: number
          size?: string | null
          unit_price: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: never
          order_id?: number
          product_id?: number | null
          product_name?: string
          quantity?: number
          size?: string | null
          unit_price?: number
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
          ambassador_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_fee: number | null
          id: number
          notes: string | null
          promo_code_id: number | null
          promo_discount: number | null
          source_link_id: number | null
          status: string
          total_amount: number
          user_id: string | null
        }
        Insert: {
          ambassador_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_fee?: number | null
          id?: number
          notes?: string | null
          promo_code_id?: number | null
          promo_discount?: number | null
          source_link_id?: number | null
          status: string
          total_amount: number
          user_id?: string | null
        }
        Update: {
          ambassador_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_fee?: number | null
          id?: number
          notes?: string | null
          promo_code_id?: number | null
          promo_discount?: number | null
          source_link_id?: number | null
          status?: string
          total_amount?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_link_id_fkey"
            columns: ["source_link_id"]
            isOneToOne: false
            referencedRelation: "ambassador_links"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          created_at: string | null
          id: number
          product_id: number
          size: string
          stock: number
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: never
          product_id: number
          size: string
          stock?: number
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: never
          product_id?: number
          size?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: number
          image_url: string | null
          images: string[] | null
          is_active: boolean
          name: string
          price: number | null
          sku: string | null
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: number
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          name: string
          price?: number | null
          sku?: string | null
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: number
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          name?: string
          price?: number | null
          sku?: string | null
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          email_verified: boolean | null
          full_name: string | null
          id: string
          name: string | null
          phone: string | null
          phone_verified: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          name?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          ambassador_id: string | null
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: number
          is_global: boolean
          max_usage: number | null
          usage_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          ambassador_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: number
          is_global?: boolean
          max_usage?: number | null
          usage_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          ambassador_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: number
          is_global?: boolean
          max_usage?: number | null
          usage_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          value: string | null
        }
        Insert: {
          description?: string | null
          key: string
          value?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order_with_items: {
        Args: {
          _customer_id: string
          _customer_name: string
          _customer_phone: string
          _delivery_address: string
          _delivery_date: string
          _delivery_fee: number
          _items: Json
          _notes: string
          _promo_code_id: number
          _promo_discount: number
          _total_amount: number
        }
        Returns: number
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
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
    Enums: {},
  },
} as const
