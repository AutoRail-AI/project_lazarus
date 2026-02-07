export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProjectStatus = 'pending' | 'processing' | 'ready' | 'building' | 'complete'
export type AssetType = 'video' | 'document' | 'repo' | 'screenshot'
export type SliceStatus = 'pending' | 'selected' | 'building' | 'testing' | 'self_healing' | 'complete' | 'failed'
export type AgentEventType = 'thought' | 'tool_call' | 'observation' | 'code_write' | 'test_run' | 'test_result' | 'self_heal' | 'confidence_update'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
export type PlanId = 'free' | 'pro' | 'enterprise'
export type WebhookEvent = 'user.created' | 'user.updated' | 'organization.created' | 'organization.updated' | 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'payment.succeeded' | 'payment.failed'
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'invitation' | 'mention'
export type TemplateType = 'prompt' | 'workflow' | 'agent' | 'form'

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          org_id: string | null
          user_id: string
          name: string
          description: string | null
          github_url: string | null
          target_framework: string | null
          status: ProjectStatus
          left_brain_status: string | null
          right_brain_status: string | null
          confidence_score: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          user_id: string
          name: string
          description?: string | null
          github_url?: string | null
          target_framework?: string | null
          status?: ProjectStatus
          left_brain_status?: string | null
          right_brain_status?: string | null
          confidence_score?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          user_id?: string
          name?: string
          description?: string | null
          github_url?: string | null
          target_framework?: string | null
          status?: ProjectStatus
          left_brain_status?: string | null
          right_brain_status?: string | null
          confidence_score?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      project_assets: {
        Row: {
          id: string
          project_id: string
          type: AssetType
          name: string
          storage_path: string
          url: string
          processing_status: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type: AssetType
          name: string
          storage_path: string
          url: string
          processing_status?: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: AssetType
          name?: string
          storage_path?: string
          url?: string
          processing_status?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      vertical_slices: {
        Row: {
          id: string
          project_id: string
          name: string
          description: string | null
          priority: number
          status: SliceStatus
          behavioral_contract: Json | null
          code_contract: Json | null
          modernization_flags: Json | null
          dependencies: string[] | null
          test_results: Json | null
          confidence_score: number
          retry_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          description?: string | null
          priority: number
          status?: SliceStatus
          behavioral_contract?: Json | null
          code_contract?: Json | null
          modernization_flags?: Json | null
          dependencies?: string[] | null
          test_results?: Json | null
          confidence_score?: number
          retry_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          description?: string | null
          priority?: number
          status?: SliceStatus
          behavioral_contract?: Json | null
          code_contract?: Json | null
          modernization_flags?: Json | null
          dependencies?: string[] | null
          test_results?: Json | null
          confidence_score?: number
          retry_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      agent_events: {
        Row: {
          id: string
          project_id: string
          slice_id: string | null
          event_type: AgentEventType
          content: string
          metadata: Json | null
          confidence_delta: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          slice_id?: string | null
          event_type: AgentEventType
          content: string
          metadata?: Json | null
          confidence_delta?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          slice_id?: string | null
          event_type?: AgentEventType
          content?: string
          metadata?: Json | null
          confidence_delta?: number | null
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          org_id: string | null
          stripe_customer_id: string
          stripe_subscription_id: string
          stripe_price_id: string
          status: SubscriptionStatus
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          plan_id: PlanId
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id?: string | null
          stripe_customer_id: string
          stripe_subscription_id: string
          stripe_price_id: string
          status: SubscriptionStatus
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          plan_id: PlanId
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string | null
          stripe_customer_id?: string
          stripe_subscription_id?: string
          stripe_price_id?: string
          status?: SubscriptionStatus
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          plan_id?: PlanId
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string
          type: string
          action: string
          resource: string
          resource_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id: string
          type: string
          action: string
          resource: string
          resource_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          organization_id?: string
          type?: string
          action?: string
          resource?: string
          resource_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string | null
          action: string
          resource: string
          resource_id: string | null
          metadata: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          action: string
          resource: string
          resource_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          action?: string
          resource?: string
          resource_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      usage: {
        Row: {
          id: string
          user_id: string
          organization_id: string | null
          api_key_id: string | null
          type: string
          resource: string
          quantity: number
          cost: number | null
          metadata: Json | null
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id?: string | null
          api_key_id?: string | null
          type: string
          resource: string
          quantity: number
          cost?: number | null
          metadata?: Json | null
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string | null
          api_key_id?: string | null
          type?: string
          resource?: string
          quantity?: number
          cost?: number | null
          metadata?: Json | null
          timestamp?: string
          created_at?: string
        }
      }
      webhooks: {
        Row: {
          id: string
          organization_id: string | null
          url: string
          secret: string
          events: WebhookEvent[]
          enabled: boolean
          last_triggered_at: string | null
          failure_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          url: string
          secret: string
          events: WebhookEvent[]
          enabled?: boolean
          last_triggered_at?: string | null
          failure_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          url?: string
          secret?: string
          events?: WebhookEvent[]
          enabled?: boolean
          last_triggered_at?: string | null
          failure_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          organization_id: string | null
          name: string
          key: string
          key_prefix: string
          last_used_at: string | null
          expires_at: string | null
          scopes: string[]
          rate_limit: Json | null
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id?: string | null
          name: string
          key: string
          key_prefix: string
          last_used_at?: string | null
          expires_at?: string | null
          scopes?: string[]
          rate_limit?: Json | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string | null
          name?: string
          key?: string
          key_prefix?: string
          last_used_at?: string | null
          expires_at?: string | null
          scopes?: string[]
          rate_limit?: Json | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      feature_flags: {
        Row: {
          id: string
          key: string
          name: string
          enabled: boolean
          rollout_percentage: number
          target_users: string[] | null
          target_organizations: string[] | null
          environments: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          name: string
          enabled?: boolean
          rollout_percentage?: number
          target_users?: string[] | null
          target_organizations?: string[] | null
          environments?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          name?: string
          enabled?: boolean
          rollout_percentage?: number
          target_users?: string[] | null
          target_organizations?: string[] | null
          environments?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          organization_id: string | null
          type: NotificationType
          title: string
          message: string
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          organization_id?: string | null
          type: NotificationType
          title: string
          message: string
          link?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          organization_id?: string | null
          type?: NotificationType
          title?: string
          message?: string
          link?: string | null
          read?: boolean
          created_at?: string
        }
      }
      onboarding: {
        Row: {
          id: string
          user_id: string
          completed_steps: string[]
          current_step: string
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          completed_steps?: string[]
          current_step?: string
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          completed_steps?: string[]
          current_step?: string
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          count: number
          reset_at: string
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          count?: number
          reset_at: string
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          count?: number
          reset_at?: string
          created_at?: string
        }
      }
      search_index: {
        Row: {
          id: string
          organization_id: string | null
          resource: string
          resource_id: string
          title: string
          content: string
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          resource: string
          resource_id: string
          title: string
          content: string
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          resource?: string
          resource_id?: string
          title?: string
          content?: string
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string | null
          name: string
          description: string | null
          type: TemplateType
          category: string | null
          tags: string[] | null
          content: Json
          variables: Json | null
          public: boolean
          featured: boolean
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          name: string
          description?: string | null
          type: TemplateType
          category?: string | null
          tags?: string[] | null
          content: Json
          variables?: Json | null
          public?: boolean
          featured?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          name?: string
          description?: string | null
          type?: TemplateType
          category?: string | null
          tags?: string[] | null
          content?: Json
          variables?: Json | null
          public?: boolean
          featured?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
