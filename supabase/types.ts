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
      bookings: {
        Row: {
          adults: number
          check_in: string
          check_out: string
          children: number
          created_at: string
          currency: string
          external_uid: string | null
          guest_id: string | null
          hold_expires_at: string | null
          ical_feed_id: string | null
          id: string
          organization_id: string
          public_token: string
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          stay: unknown
          stripe_checkout_session_id: string | null
          total_amount: number
          unit_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adults?: number
          check_in: string
          check_out: string
          children?: number
          created_at?: string
          currency?: string
          external_uid?: string | null
          guest_id?: string | null
          hold_expires_at?: string | null
          ical_feed_id?: string | null
          id?: string
          organization_id: string
          public_token?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          stay?: unknown
          stripe_checkout_session_id?: string | null
          total_amount?: number
          unit_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adults?: number
          check_in?: string
          check_out?: string
          children?: number
          created_at?: string
          currency?: string
          external_uid?: string | null
          guest_id?: string | null
          hold_expires_at?: string | null
          ical_feed_id?: string | null
          id?: string
          organization_id?: string
          public_token?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          stay?: unknown
          stripe_checkout_session_id?: string | null
          total_amount?: number
          unit_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "bookings_ical_feed_id_fkey"
            columns: ["ical_feed_id", "unit_id", "source"]
            isOneToOne: false
            referencedRelation: "ical_feeds"
            referencedColumns: ["id", "unit_id", "provider"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_unit_id_fkey"
            columns: ["unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      cancellation_policies: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unit_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ical_feeds: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_status: string | null
          last_sync_at: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["booking_source"]
          unit_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          organization_id: string
          provider: Database["public"]["Enums"]["booking_source"]
          unit_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["booking_source"]
          unit_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ical_feeds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ical_feeds_unit_id_fkey"
            columns: ["unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_address: string | null
          country: string
          created_at: string
          cui: string | null
          id: string
          legal_name: string | null
          name: string
          reg_com: string | null
          slug: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          country?: string
          created_at?: string
          cui?: string | null
          id?: string
          legal_name?: string | null
          name: string
          reg_com?: string | null
          slug: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          country?: string
          created_at?: string
          cui?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          reg_com?: string | null
          slug?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          organization_id: string
          refunded_amount: number
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          organization_id: string
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string
          refunded_amount?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          is_cover: boolean
          organization_id: string
          position: number
          property_id: string
          storage_path: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          organization_id: string
          position?: number
          property_id: string
          storage_path: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          organization_id?: string
          position?: number
          property_id?: string
          storage_path?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_property_id_fkey"
            columns: ["property_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "photos_unit_id_fkey"
            columns: ["unit_id", "property_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: Json
          cancellation_policy_id: string | null
          check_in_time: string
          check_out_time: string
          checkin_instructions: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: Json
          cancellation_policy_id?: string | null
          check_in_time?: string
          check_out_time?: string
          checkin_instructions?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: Json
          cancellation_policy_id?: string | null
          check_in_time?: string
          check_out_time?: string
          checkin_instructions?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          created_at: string
          id: string
          key_hash: string
          updated_at: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          key_hash: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          key_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_salt: {
        Row: {
          created_at: string
          id: string
          salt: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          salt?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          salt?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          booking_id: string | null
          conflict_range: unknown
          created_at: string
          external_uid: string | null
          feed_id: string | null
          id: string
          organization_id: string
          resolved_at: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          conflict_range: unknown
          created_at?: string
          external_uid?: string | null
          feed_id?: string | null
          id?: string
          organization_id: string
          resolved_at?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          conflict_range?: unknown
          created_at?: string
          external_uid?: string | null
          feed_id?: string | null
          id?: string
          organization_id?: string
          resolved_at?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_booking_id_fkey"
            columns: ["booking_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "unit_id"]
          },
          {
            foreignKeyName: "sync_conflicts_feed_id_fkey"
            columns: ["feed_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "ical_feeds"
            referencedColumns: ["id", "unit_id"]
          },
          {
            foreignKeyName: "sync_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_unit_id_fkey"
            columns: ["unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      unit_prices: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          id: string
          kind: Database["public"]["Enums"]["price_kind"]
          min_nights: number
          organization_id: string
          price_per_night: number
          priority: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          kind: Database["public"]["Enums"]["price_kind"]
          min_nights?: number
          organization_id: string
          price_per_night: number
          priority?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["price_kind"]
          min_nights?: number
          organization_id?: string
          price_per_night?: number
          priority?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_prices_unit_id_fkey"
            columns: ["unit_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      units: {
        Row: {
          amenities: Json
          area_m2: number | null
          bathrooms: number
          bedrooms: number
          beds: number
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          max_guests: number
          name: string
          organization_id: string
          position: number
          property_id: string
          type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          amenities?: Json
          area_m2?: number | null
          bathrooms?: number
          bedrooms?: number
          beds?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          max_guests: number
          name: string
          organization_id: string
          position?: number
          property_id: string
          type: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          amenities?: Json
          area_m2?: number | null
          bathrooms?: number
          bedrooms?: number
          beds?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          max_guests?: number
          name?: string
          organization_id?: string
          position?: number
          property_id?: string
          type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bucharest_today: { Args: { p_now?: string }; Returns: string }
      confirm_booking: { Args: { p_booking_id: string }; Returns: undefined }
      create_manual_booking: {
        Args: {
          p_adults?: number
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_email?: string
          p_full_name: string
          p_phone?: string
          p_total_amount?: number
          p_unit_id: string
        }
        Returns: string
      }
      create_public_booking: {
        Args: {
          p_adults?: number
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_email: string
          p_full_name: string
          p_phone: string
          p_unit_id: string
        }
        Returns: {
          booking_id: string
          hold_expires_at: string
          public_token: string
          total: number
        }[]
      }
      dashboard_chart: {
        Args: { p_from: string; p_property_id?: string; p_to: string }
        Returns: {
          adults: number
          booking_id: string
          check_in: string
          check_out: string
          children: number
          currency: string
          guest_name: string
          hold_expires_at: string
          property_id: string
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          unit_id: string
        }[]
      }
      dashboard_kpis: {
        Args: { p_day?: string }
        Returns: {
          arrivals_today: number
          currency: string
          departures_today: number
          kpi_day: string
          occupancy_pct: number
          revenue_month: number
        }[]
      }
      decline_booking: { Args: { p_booking_id: string }; Returns: undefined }
      expire_holds: { Args: { p_unit_id?: string }; Returns: number }
      is_live_booking: {
        Args: {
          p_hold_expires_at: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_own_storage_path: { Args: { path: string }; Returns: boolean }
      is_public_unit: { Args: { p_unit_id: string }; Returns: boolean }
      my_bookings: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          adults: number
          booking_id: string
          check_in: string
          check_out: string
          children: number
          city: string
          created_at: string
          currency: string
          hold_expires_at: string
          property_name: string
          public_token: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          total_count: number
          unit_id: string
          unit_name: string
        }[]
      }
      pending_requests: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          adults: number
          booking_id: string
          check_in: string
          check_out: string
          children: number
          created_at: string
          currency: string
          guest_email: string
          guest_name: string
          guest_phone: string
          hold_expires_at: string
          property_id: string
          property_name: string
          total_amount: number
          total_count: number
          unit_id: string
          unit_name: string
        }[]
      }
      pending_requests_count: { Args: never; Returns: number }
      public_booking_status: {
        Args: { p_token: string }
        Returns: {
          check_in: string
          check_out: string
          currency: string
          property_name: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          unit_name: string
        }[]
      }
      public_busy_ranges: {
        Args: { p_from: string; p_to: string; p_unit_id: string }
        Returns: {
          busy_from: string
          busy_to: string
        }[]
      }
      public_quote: {
        Args: {
          p_adults?: number
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_unit_id: string
        }
        Returns: {
          currency: string
          nightly: Json
          nights: number
          ok: boolean
          reason: string
          total: number
        }[]
      }
      rate_limit_hit: {
        Args: {
          p_bucket: string
          p_ip: string
          p_max?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          hits: number
          retry_after_seconds: number
        }[]
      }
      reorder_photos: {
        Args: {
          p_cover_id?: string
          p_photo_ids: string[]
          p_property_id: string
        }
        Returns: undefined
      }
      reorder_units: {
        Args: { p_property_id: string; p_unit_ids: string[] }
        Returns: undefined
      }
      save_unit: {
        Args: {
          p_amenities: Json
          p_area_m2: number
          p_base_price: number
          p_bathrooms: number
          p_bedrooms: number
          p_beds: number
          p_description: string
          p_is_published: boolean
          p_max_guests: number
          p_name: string
          p_property_id: string
          p_type: string
          p_unit_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      booking_source: "direct" | "booking" | "airbnb" | "altul"
      booking_status: "hold" | "confirmed" | "blocked" | "cancelled" | "expired"
      member_role: "owner"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      price_kind: "base" | "weekend" | "season"
      property_status: "activa" | "ascunsa"
      unit_type: "camera" | "apartament" | "garsoniera" | "casuta"
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
      booking_source: ["direct", "booking", "airbnb", "altul"],
      booking_status: ["hold", "confirmed", "blocked", "cancelled", "expired"],
      member_role: ["owner"],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      price_kind: ["base", "weekend", "season"],
      property_status: ["activa", "ascunsa"],
      unit_type: ["camera", "apartament", "garsoniera", "casuta"],
    },
  },
} as const
