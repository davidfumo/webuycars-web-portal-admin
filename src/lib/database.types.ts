export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppUserRole =
  | "buyer"
  | "seller"
  | "private_seller"
  | "dealer"
  | "dealer_manager"
  | "dealer_staff"
  | "admin";

export type DealerStaffRole = "manager" | "staff";

export type ListingStatus =
  | "draft"
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "published"
  | "rejected"
  | "expired"
  | "sold";

export type SubscriptionStatus =
  | "pending_payment"
  | "active"
  | "expired"
  | "suspended";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export type PaymentMethod = "mpesa" | "emola" | "card";

export type PaymentType =
  | "subscription"
  | "listing"
  | "extra_listing"
  | "sponsorship"
  | "feature"
  | "upgrade"
  | "other";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string | null;
          email: string | null;
          role: AppUserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          phone?: string | null;
          email?: string | null;
          role?: AppUserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone?: string | null;
          email?: string | null;
          role?: AppUserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          province: string | null;
          city: string | null;
          avatar_url: string | null;
          preferred_locale: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          province?: string | null;
          city?: string | null;
          avatar_url?: string | null;
          preferred_locale?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          province?: string | null;
          city?: string | null;
          avatar_url?: string | null;
          preferred_locale?: string | null;
        };
        Relationships: [];
      };
      dealers: {
        Row: {
          id: string;
          business_name: string;
          logo_url: string | null;
          province: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          slug: string | null;
          description: string | null;
          province_id: string | null;
          address: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_name: string;
          logo_url?: string | null;
          province?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          slug?: string | null;
          description?: string | null;
          province_id?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          logo_url?: string | null;
          province?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          slug?: string | null;
          description?: string | null;
          province_id?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      dealer_staff: {
        Row: {
          id: string;
          dealer_id: string;
          user_id: string;
          role: DealerStaffRole;
          is_active: boolean;
          onboarding_required?: boolean;
          onboarding_completed_at?: string | null;
        };
        Insert: {
          id?: string;
          dealer_id: string;
          user_id: string;
          role: DealerStaffRole;
          is_active?: boolean;
          onboarding_required?: boolean;
          onboarding_completed_at?: string | null;
        };
        Update: {
          id?: string;
          dealer_id?: string;
          user_id?: string;
          role?: DealerStaffRole;
          is_active?: boolean;
          onboarding_required?: boolean;
          onboarding_completed_at?: string | null;
        };
        Relationships: [];
      };
      dealer_packages: {
        Row: {
          id: string;
          name: string;
          slug: string;
          listing_limit: number;
          price: number;
          price_per_extra_listing: number;
          duration_days: number;
          is_active: boolean;
          created_at: string;
          featured_listing_allowance: number;
          sponsored_listing_allowance: number;
          priority_support: boolean;
          /** dealer | private | all — which channels can use this catalog row */
          seller_scope: "dealer" | "private" | "all";
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          listing_limit: number;
          price: number;
          price_per_extra_listing?: number;
          duration_days: number;
          is_active?: boolean;
          created_at?: string;
          featured_listing_allowance?: number;
          sponsored_listing_allowance?: number;
          priority_support?: boolean;
          seller_scope?: "dealer" | "private" | "all";
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          listing_limit?: number;
          price?: number;
          price_per_extra_listing?: number;
          duration_days?: number;
          is_active?: boolean;
          created_at?: string;
          featured_listing_allowance?: number;
          sponsored_listing_allowance?: number;
          priority_support?: boolean;
          seller_scope?: "dealer" | "private" | "all";
        };
        Relationships: [];
      };
      dealer_subscriptions: {
        Row: {
          id: string;
          dealer_id: string;
          package_id: string;
          status: SubscriptionStatus;
          listings_used: number;
          started_at: string | null;
          expires_at: string | null;
          created_at: string;
          featured_used: number;
          sponsored_used: number;
        };
        Insert: {
          id?: string;
          dealer_id: string;
          package_id: string;
          status?: SubscriptionStatus;
          listings_used?: number;
          started_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          featured_used?: number;
          sponsored_used?: number;
        };
        Update: {
          id?: string;
          dealer_id?: string;
          package_id?: string;
          status?: SubscriptionStatus;
          listings_used?: number;
          started_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          featured_used?: number;
          sponsored_used?: number;
        };
        Relationships: [];
      };
      vehicle_listings: {
        Row: {
          id: string;
          title: string;
          make: string | null;
          model: string | null;
          year: number | null;
          price: number | null;
          mileage: number | null;
          fuel_type: string | null;
          transmission: string | null;
          condition: string | null;
          description: string | null;
          seller_type: "private" | "dealer";
          user_id: string | null;
          dealer_id: string | null;
          status: ListingStatus;
          created_at: string;
          brand_id: string | null;
          model_id: string | null;
          body_type_id: string | null;
          province_id: string | null;
          color: string | null;
          currency: string;
          views_count: number;
          favorites_count: number;
          leads_count: number;
          expires_at: string | null;
          published_at: string | null;
          updated_at: string;
          is_featured: boolean;
          is_sponsored: boolean;
          featured_until: string | null;
          sponsored_until: string | null;
          listing_billing_mode: "subscription_allowance" | "pay_per_listing" | null;
        };
        Insert: {
          id?: string;
          title: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          price?: number | null;
          mileage?: number | null;
          fuel_type?: string | null;
          transmission?: string | null;
          condition?: string | null;
          description?: string | null;
          seller_type: "private" | "dealer";
          user_id?: string | null;
          dealer_id?: string | null;
          status?: ListingStatus;
          created_at?: string;
          brand_id?: string | null;
          model_id?: string | null;
          body_type_id?: string | null;
          province_id?: string | null;
          color?: string | null;
          currency?: string;
          views_count?: number;
          favorites_count?: number;
          leads_count?: number;
          expires_at?: string | null;
          published_at?: string | null;
          updated_at?: string;
          is_featured?: boolean;
          is_sponsored?: boolean;
          featured_until?: string | null;
          sponsored_until?: string | null;
          listing_billing_mode?: "subscription_allowance" | "pay_per_listing" | null;
        };
        Update: {
          id?: string;
          title?: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          price?: number | null;
          mileage?: number | null;
          fuel_type?: string | null;
          transmission?: string | null;
          condition?: string | null;
          description?: string | null;
          seller_type?: "private" | "dealer";
          user_id?: string | null;
          dealer_id?: string | null;
          status?: ListingStatus;
          created_at?: string;
          brand_id?: string | null;
          model_id?: string | null;
          body_type_id?: string | null;
          province_id?: string | null;
          color?: string | null;
          currency?: string;
          views_count?: number;
          favorites_count?: number;
          leads_count?: number;
          expires_at?: string | null;
          published_at?: string | null;
          updated_at?: string;
          is_featured?: boolean;
          is_sponsored?: boolean;
          featured_until?: string | null;
          sponsored_until?: string | null;
          listing_billing_mode?: "subscription_allowance" | "pay_per_listing" | null;
        };
        Relationships: [];
      };
      listing_photos: {
        Row: {
          id: string;
          listing_id: string;
          image_url: string;
          sort_order: number;
          is_cover: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          image_url: string;
          sort_order?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          image_url?: string;
          sort_order?: number;
          is_cover?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string | null;
          amount: number;
          payment_method: PaymentMethod | null;
          payment_status: PaymentStatus;
          created_at: string;
          dealer_id: string | null;
          subscription_id: string | null;
          currency: string;
          gateway_reference: string | null;
          payment_type: PaymentType;
          paysuite_payment_id: string | null;
          paysuite_reference: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id?: string | null;
          amount: number;
          payment_method?: PaymentMethod | null;
          payment_status?: PaymentStatus;
          created_at?: string;
          dealer_id?: string | null;
          subscription_id?: string | null;
          currency?: string;
          gateway_reference?: string | null;
          payment_type?: PaymentType;
          paysuite_payment_id?: string | null;
          paysuite_reference?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          listing_id?: string | null;
          amount?: number;
          payment_method?: PaymentMethod | null;
          payment_status?: PaymentStatus;
          created_at?: string;
          dealer_id?: string | null;
          subscription_id?: string | null;
          currency?: string;
          gateway_reference?: string | null;
          payment_type?: PaymentType;
          paysuite_payment_id?: string | null;
          paysuite_reference?: string | null;
        };
        Relationships: [];
      };
      payment_logs: {
        Row: {
          id: string;
          payment_id: string;
          provider_response: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          provider_response?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          provider_response?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      provinces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      body_types: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      vehicle_brands: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      vehicle_models: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          listing_id: string;
          buyer_user_id: string | null;
          seller_user_id: string | null;
          message: string | null;
          contact_phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          buyer_user_id?: string | null;
          seller_user_id?: string | null;
          message?: string | null;
          contact_phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          buyer_user_id?: string | null;
          seller_user_id?: string | null;
          message?: string | null;
          contact_phone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string | null;
          is_read: boolean;
          created_at: string;
          type: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message?: string | null;
          is_read?: boolean;
          created_at?: string;
          type?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string | null;
          is_read?: boolean;
          created_at?: string;
          type?: string | null;
        };
        Relationships: [];
      };
      listing_moderation_logs: {
        Row: {
          id: string;
          listing_id: string;
          moderator_id: string | null;
          action: "approved" | "rejected" | "edited";
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          moderator_id?: string | null;
          action: "approved" | "rejected" | "edited";
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          moderator_id?: string | null;
          action?: "approved" | "rejected" | "edited";
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      complete_listing_payment_simulation: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      complete_subscription_payment_simulation: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      complete_subscription_payment_gateway: {
        Args: { p_payment_id: string; p_gateway_reference: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
