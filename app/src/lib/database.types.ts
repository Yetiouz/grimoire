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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      campaign_events: {
        Row: {
          actor: string
          campaign_id: string
          created_at: string
          id: string
          kind: string
          payload: Json
        }
        Insert: {
          actor: string
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
        }
        Update: {
          actor?: string
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_map_markers: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          label: string
          marker_kind: string
          notes: string | null
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          label: string
          marker_kind?: string
          notes?: string | null
          updated_at?: string
          x: number
          y: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          marker_kind?: string
          notes?: string | null
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_map_markers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_map_position: {
        Row: {
          campaign_id: string
          hexes_remaining: number | null
          location_label: string | null
          travel_pace: string | null
          updated_at: string
          x: number | null
          y: number | null
        }
        Insert: {
          campaign_id: string
          hexes_remaining?: number | null
          location_label?: string | null
          travel_pace?: string | null
          updated_at?: string
          x?: number | null
          y?: number | null
        }
        Update: {
          campaign_id?: string
          hexes_remaining?: number | null
          location_label?: string | null
          travel_pace?: string | null
          updated_at?: string
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_map_position_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_maps: {
        Row: {
          campaign_id: string
          created_at: string
          handout_storage_path: string | null
          id: string
          kind: string
          label: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          handout_storage_path?: string | null
          id?: string
          kind: string
          label: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          handout_storage_path?: string | null
          id?: string
          kind?: string
          label?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_maps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_notes: {
        Row: {
          body: string
          campaign_id: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          body?: string
          campaign_id: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: string
          campaign_id?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          canon: string | null
          created_at: string
          gm_mode: string
          id: string
          join_code: string | null
          name: string
          owner: string
          system: string
        }
        Insert: {
          canon?: string | null
          created_at?: string
          gm_mode?: string
          id?: string
          join_code?: string | null
          name: string
          owner: string
          system?: string
        }
        Update: {
          canon?: string | null
          created_at?: string
          gm_mode?: string
          id?: string
          join_code?: string | null
          name?: string
          owner?: string
          system?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        Insert: {
          abilities?: Json
          ac: number
          alignment_title?: string | null
          background?: string | null
          campaign_id: string
          class_title: string
          color?: string | null
          created_at?: string
          gear_current?: number | null
          gear_max?: number | null
          gold?: Json
          hp_current: number
          hp_max: number
          id?: string
          level?: number
          luck_tokens?: number
          member_id?: string | null
          name: string
          sheet?: Json
          status?: string
          xp_current?: number
          xp_needed?: number
        }
        Update: {
          abilities?: Json
          ac?: number
          alignment_title?: string | null
          background?: string | null
          campaign_id?: string
          class_title?: string
          color?: string | null
          created_at?: string
          gear_current?: number | null
          gear_max?: number | null
          gold?: Json
          hp_current?: number
          hp_max?: number
          id?: string
          level?: number
          luck_tokens?: number
          member_id?: string | null
          name?: string
          sheet?: Json
          status?: string
          xp_current?: number
          xp_needed?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "campaign_members"
            referencedColumns: ["id"]
          },
        ]
      }
      clocks: {
        Row: {
          campaign_id: string
          created_at: string
          description: string
          faction_id: string | null
          filled: number
          id: string
          name: string
          revealed: boolean
          segments: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string
          faction_id?: string | null
          filled?: number
          id?: string
          name: string
          revealed?: boolean
          segments: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string
          faction_id?: string | null
          filled?: number
          id?: string
          name?: string
          revealed?: boolean
          segments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clocks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clocks_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_monsters: {
        Row: {
          campaign_id: string
          created_at: string
          hp_visible_to_players: boolean
          id: string
          label: string
          stat_block: Json
          visible_to_players: boolean
          zone: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          hp_visible_to_players?: boolean
          id?: string
          label: string
          stat_block?: Json
          visible_to_players?: boolean
          zone?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          hp_visible_to_players?: boolean
          id?: string
          label?: string
          stat_block?: Json
          visible_to_players?: boolean
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_monsters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      factions: {
        Row: {
          campaign_id: string
          created_at: string
          disposition: string | null
          goal: string | null
          id: string
          leader: string | null
          name: string
          notes: string | null
          status: string | null
          territory: string | null
          type: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          disposition?: string | null
          goal?: string | null
          id?: string
          leader?: string | null
          name: string
          notes?: string | null
          status?: string | null
          territory?: string | null
          type?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          disposition?: string | null
          goal?: string | null
          id?: string
          leader?: string | null
          name?: string
          notes?: string | null
          status?: string | null
          territory?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_chat: {
        Row: {
          body: string
          campaign_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          body: string
          campaign_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          body?: string
          campaign_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gm_chat_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_checks: {
        Row: {
          ability: string
          advantage: string | null
          bands: Json
          campaign_id: string
          character_id: string | null
          created_at: string
          dc: number
          id: string
          resolved_at: string | null
          resolved_band: Json | null
          resolved_roll: number | null
          resolved_source: string | null
          resolved_total: number | null
          session_id: string | null
          stakes: string | null
          status: string
        }
        Insert: {
          ability: string
          advantage?: string | null
          bands: Json
          campaign_id: string
          character_id?: string | null
          created_at?: string
          dc: number
          id?: string
          resolved_at?: string | null
          resolved_band?: Json | null
          resolved_roll?: number | null
          resolved_source?: string | null
          resolved_total?: number | null
          session_id?: string | null
          stakes?: string | null
          status?: string
        }
        Update: {
          ability?: string
          advantage?: string | null
          bands?: Json
          campaign_id?: string
          character_id?: string | null
          created_at?: string
          dc?: number
          id?: string
          resolved_at?: string | null
          resolved_band?: Json | null
          resolved_roll?: number | null
          resolved_source?: string | null
          resolved_total?: number | null
          session_id?: string | null
          stakes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gm_checks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gm_checks_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gm_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_dice_pools: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gm_dice_pools_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_pool_dice: {
        Row: {
          consumed_at: string | null
          die: string
          pool_id: string
          seq: number
          value: number
        }
        Insert: {
          consumed_at?: string | null
          die: string
          pool_id: string
          seq: number
          value: number
        }
        Update: {
          consumed_at?: string | null
          die?: string
          pool_id?: string
          seq?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "gm_pool_dice_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "gm_dice_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_turns: {
        Row: {
          campaign_id: string
          created_at: string
          error: string | null
          id: string
          input_tokens: number | null
          inventions: Json | null
          mode: string
          output_tokens: number | null
          request_count: number
          session_id: string | null
          status: string
          transcript: Json | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          inventions?: Json | null
          mode?: string
          output_tokens?: number | null
          request_count?: number
          session_id?: string | null
          status: string
          transcript?: Json | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          inventions?: Json | null
          mode?: string
          output_tokens?: number | null
          request_count?: number
          session_id?: string | null
          status?: string
          transcript?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gm_turns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gm_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          actor_color: string | null
          actor_name: string
          author: string
          body: string
          campaign_id: string
          created_at: string
          id: string
          kind: string
          session_id: string
        }
        Insert: {
          actor_color?: string | null
          actor_name: string
          author: string
          body: string
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          session_id: string
        }
        Update: {
          actor_color?: string | null
          actor_name?: string
          author?: string
          body?: string
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      location_secrets: {
        Row: {
          campaign_id: string
          location_id: string
          notes: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          location_id: string
          notes?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          location_id?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_secrets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          name: string
          status: string | null
          summary: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          status?: string | null
          summary?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          status?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_stat_blocks: {
        Row: {
          campaign_id: string
          npc_id: string
          stat_block: Json
          updated_at: string
        }
        Insert: {
          campaign_id: string
          npc_id: string
          stat_block: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          npc_id?: string
          stat_block?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npc_stat_blocks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "npc_stat_blocks_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: true
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          attitude: string | null
          campaign_id: string
          created_at: string
          hire_terms: string | null
          id: string
          is_hireling: boolean
          location: string | null
          name: string
          role: string | null
          status: string
          summary: string
        }
        Insert: {
          attitude?: string | null
          campaign_id: string
          created_at?: string
          hire_terms?: string | null
          id?: string
          is_hireling?: boolean
          location?: string | null
          name: string
          role?: string | null
          status?: string
          summary?: string
        }
        Update: {
          attitude?: string | null
          campaign_id?: string
          created_at?: string
          hire_terms?: string | null
          id?: string
          is_hireling?: boolean
          location?: string | null
          name?: string
          role?: string | null
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          campaign_id: string
          claimant: string | null
          code: string
          created_at: string
          goal: string | null
          id: string
          sort_order: number
          status: string
          summary: string
          title: string
        }
        Insert: {
          campaign_id: string
          claimant?: string | null
          code: string
          created_at?: string
          goal?: string | null
          id?: string
          sort_order?: number
          status: string
          summary?: string
          title: string
        }
        Update: {
          campaign_id?: string
          claimant?: string | null
          code?: string
          created_at?: string
          goal?: string | null
          id?: string
          sort_order?: number
          status?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_positions: {
        Row: {
          campaign_id: string
          character_id: string
          id: string
          updated_at: string
          zone: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          id?: string
          updated_at?: string
          zone?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          id?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_positions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_positions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          campaign_id: string
          ended_at: string | null
          id: string
          number: number
          paused_at: string | null
          started_at: string
          title: string | null
        }
        Insert: {
          campaign_id: string
          ended_at?: string | null
          id?: string
          number: number
          paused_at?: string | null
          started_at?: string
          title?: string | null
        }
        Update: {
          campaign_id?: string
          ended_at?: string | null
          id?: string
          number?: number
          paused_at?: string | null
          started_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      system_packs: {
        Row: {
          body: string
          section: string
          sort_order: number
          system: string
          title: string | null
          updated_at: string
          use_in_play: boolean
          use_in_rules: boolean
        }
        Insert: {
          body: string
          section: string
          sort_order?: number
          system: string
          title?: string | null
          updated_at?: string
          use_in_play?: boolean
          use_in_rules?: boolean
        }
        Update: {
          body?: string
          section?: string
          sort_order?: number
          system?: string
          title?: string | null
          updated_at?: string
          use_in_play?: boolean
          use_in_rules?: boolean
        }
        Relationships: []
      }
      treasure: {
        Row: {
          campaign_id: string
          category: string | null
          created_at: string
          held_by: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          quantity_value: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          category?: string | null
          created_at?: string
          held_by?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          quantity_value?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          category?: string | null
          created_at?: string
          held_by?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          quantity_value?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasure_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      turn_order: {
        Row: {
          active_index: number
          campaign_id: string
          combatants: Json
          round_number: number
          started_at: string | null
        }
        Insert: {
          active_index?: number
          campaign_id: string
          combatants?: Json
          round_number?: number
          started_at?: string | null
        }
        Update: {
          active_index?: number
          campaign_id?: string
          combatants?: Json
          round_number?: number
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turn_order_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_character_gear: {
        Args: {
          p_character_id: string
          p_item_name: string
          p_session_id?: string
        }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_encounter_monster: {
        Args: {
          p_campaign_id: string
          p_label: string
          p_stat_block?: Json
          p_zone?: string
        }
        Returns: {
          campaign_id: string
          created_at: string
          hp_visible_to_players: boolean
          id: string
          label: string
          stat_block: Json
          visible_to_players: boolean
          zone: string
        }
        SetofOptions: {
          from: "*"
          to: "encounter_monsters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_map_marker: {
        Args: {
          p_campaign_id: string
          p_kind: string
          p_label: string
          p_marker_kind?: string
          p_notes?: string
          p_x: number
          p_y: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          label: string
          marker_kind: string
          notes: string | null
          updated_at: string
          x: number
          y: number
        }
        SetofOptions: {
          from: "*"
          to: "campaign_map_markers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_character_gold: {
        Args: {
          p_character_id: string
          p_cp?: number
          p_gp?: number
          p_session_id?: string
          p_sp?: number
        }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_character_hp: {
        Args: { p_character_id: string; p_delta: number; p_session_id?: string }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_character_luck: {
        Args: { p_character_id: string; p_delta: number; p_session_id?: string }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_character_xp: {
        Args: { p_character_id: string; p_delta: number; p_session_id?: string }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_clock: {
        Args: { p_clock_id: string; p_delta: number }
        Returns: {
          campaign_id: string
          created_at: string
          description: string
          faction_id: string | null
          filled: number
          id: string
          name: string
          revealed: boolean
          segments: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_turn: {
        Args: { p_campaign_id: string }
        Returns: {
          active_index: number
          campaign_id: string
          combatants: Json
          round_number: number
          started_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "turn_order"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      amend_journal_entry: {
        Args: { p_entry_id: string; p_new_body: string }
        Returns: {
          actor_color: string | null
          actor_name: string
          author: string
          body: string
          campaign_id: string
          created_at: string
          id: string
          kind: string
          session_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_campaign_map: {
        Args: { p_campaign_id: string; p_kind: string }
        Returns: undefined
      }
      clear_map_handout: {
        Args: { p_campaign_id: string; p_kind: string }
        Returns: {
          campaign_id: string
          created_at: string
          handout_storage_path: string | null
          id: string
          kind: string
          label: string
          storage_path: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_maps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_scene: { Args: { p_campaign_id: string }; Returns: undefined }
      create_campaign: {
        Args: { p_name: string }
        Returns: {
          canon: string | null
          created_at: string
          gm_mode: string
          id: string
          join_code: string | null
          name: string
          owner: string
          system: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_character: {
        Args: {
          p_abilities?: Json
          p_ac: number
          p_alignment_title?: string
          p_background?: string
          p_campaign_id: string
          p_class_title: string
          p_color?: string
          p_gear_max?: number
          p_gold?: Json
          p_hp_max: number
          p_level?: number
          p_member_id?: string
          p_name: string
          p_session_id?: string
          p_sheet?: Json
          p_status?: string
          p_xp_needed?: number
        }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_clock: {
        Args: {
          p_campaign_id: string
          p_description?: string
          p_faction_id?: string
          p_name: string
          p_segments: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          description: string
          faction_id: string | null
          filled: number
          id: string
          name: string
          revealed: boolean
          segments: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      damage_encounter_monster: {
        Args: { p_delta: number; p_monster_id: string }
        Returns: {
          campaign_id: string
          created_at: string
          hp_visible_to_players: boolean
          id: string
          label: string
          stat_block: Json
          visible_to_players: boolean
          zone: string
        }
        SetofOptions: {
          from: "*"
          to: "encounter_monsters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_clock: { Args: { p_clock_id: string }; Returns: undefined }
      end_encounter: {
        Args: { p_campaign_id: string; p_session_id?: string }
        Returns: undefined
      }
      end_session: {
        Args: { p_campaign_id: string; p_recap_note?: string }
        Returns: {
          campaign_id: string
          ended_at: string | null
          id: string
          number: number
          paused_at: string | null
          started_at: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_campaign_join_code: {
        Args: { p_campaign_id: string }
        Returns: string
      }
      gm_budget_since: {
        Args: { p_campaign_id: string; p_since: string }
        Returns: {
          campaign_used: number
          user_used: number
        }[]
      }
      gm_budget_since_by_mode: {
        Args: { p_campaign_id: string; p_since: string }
        Returns: {
          campaign_used_text: number
          campaign_used_voice: number
          user_used_text: number
          user_used_voice: number
        }[]
      }
      gm_check_is_member: { Args: { p_campaign_id: string }; Returns: boolean }
      gm_consume_die: {
        Args: { p_die: string; p_pool_id: string }
        Returns: Json
      }
      gm_create_check: {
        Args: {
          p_ability: string
          p_advantage: string
          p_bands: Json
          p_campaign_id: string
          p_character_id: string
          p_dc: number
          p_session_id: string
          p_stakes: string
        }
        Returns: string
      }
      gm_create_dice_pool: { Args: { p_campaign_id: string }; Returns: string }
      gm_list_checks: {
        Args: { p_campaign_id: string }
        Returns: {
          ability: string
          advantage: string
          character_id: string
          created_at: string
          dc: number
          id: string
          resolved_at: string
          resolved_band: Json
          resolved_roll: number
          resolved_source: string
          resolved_total: number
          session_id: string
          stakes: string
          status: string
        }[]
      }
      gm_record_chat: {
        Args: { p_body: string; p_campaign_id: string; p_role: string }
        Returns: {
          body: string
          campaign_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "gm_chat"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gm_record_turn: {
        Args: {
          p_campaign_id: string
          p_error?: string
          p_input_tokens?: number
          p_inventions?: Json
          p_mode?: string
          p_output_tokens?: number
          p_request_count: number
          p_session_id: string
          p_status: string
          p_transcript?: Json
        }
        Returns: string
      }
      join_campaign_by_code: {
        Args: { p_code: string }
        Returns: {
          canon: string | null
          created_at: string
          gm_mode: string
          id: string
          join_code: string | null
          name: string
          owner: string
          system: string
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_journal_entry: {
        Args: {
          p_actor_color?: string
          p_actor_name: string
          p_body: string
          p_campaign_id: string
          p_kind: string
          p_session_id: string
        }
        Returns: {
          actor_color: string | null
          actor_name: string
          author: string
          body: string
          campaign_id: string
          created_at: string
          id: string
          kind: string
          session_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pause_session: {
        Args: { p_campaign_id: string }
        Returns: {
          campaign_id: string
          ended_at: string | null
          id: string
          number: number
          paused_at: string | null
          started_at: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_character_gear: {
        Args: {
          p_character_id: string
          p_item_index: number
          p_session_id?: string
        }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_map_marker: { Args: { p_marker_id: string }; Returns: undefined }
      resolve_check: {
        Args: { p_check_id: string; p_source: string; p_total?: number }
        Returns: Json
      }
      rest_character: {
        Args: { p_character_id: string; p_session_id?: string }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resume_session: {
        Args: { p_campaign_id: string }
        Returns: {
          campaign_id: string
          ended_at: string | null
          id: string
          number: number
          paused_at: string | null
          started_at: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roll_dice: {
        Args: {
          p_campaign_id: string
          p_count?: number
          p_die: string
          p_mode?: string
        }
        Returns: Json
      }
      roll_initiative: {
        Args: { p_campaign_id: string }
        Returns: {
          active_index: number
          campaign_id: string
          combatants: Json
          round_number: number
          started_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "turn_order"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_campaign_map: {
        Args: {
          p_campaign_id: string
          p_kind: string
          p_label: string
          p_storage_path: string
        }
        Returns: {
          campaign_id: string
          created_at: string
          handout_storage_path: string | null
          id: string
          kind: string
          label: string
          storage_path: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_maps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_character_hp_max: {
        Args: {
          p_character_id: string
          p_hp_max: number
          p_session_id?: string
        }
        Returns: {
          abilities: Json
          ac: number
          alignment_title: string | null
          background: string | null
          campaign_id: string
          class_title: string
          color: string | null
          created_at: string
          gear_current: number | null
          gear_max: number | null
          gold: Json
          hp_current: number
          hp_max: number
          id: string
          level: number
          luck_tokens: number
          member_id: string | null
          name: string
          sheet: Json
          status: string
          xp_current: number
          xp_needed: number
        }
        SetofOptions: {
          from: "*"
          to: "characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_map_handout: {
        Args: { p_campaign_id: string; p_kind: string; p_storage_path: string }
        Returns: {
          campaign_id: string
          created_at: string
          handout_storage_path: string | null
          id: string
          kind: string
          label: string
          storage_path: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "campaign_maps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_monster_visibility: {
        Args: {
          p_hp_visible_to_players?: boolean
          p_monster_id: string
          p_visible_to_players?: boolean
        }
        Returns: {
          campaign_id: string
          created_at: string
          hp_visible_to_players: boolean
          id: string
          label: string
          stat_block: Json
          visible_to_players: boolean
          zone: string
        }
        SetofOptions: {
          from: "*"
          to: "encounter_monsters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_party_position: {
        Args: {
          p_campaign_id: string
          p_clear_pin?: boolean
          p_hexes_remaining?: number
          p_location_label?: string
          p_travel_pace?: string
          p_x?: number
          p_y?: number
        }
        Returns: {
          campaign_id: string
          hexes_remaining: number | null
          location_label: string | null
          travel_pace: string | null
          updated_at: string
          x: number | null
          y: number | null
        }
        SetofOptions: {
          from: "*"
          to: "campaign_map_position"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_scene_position: {
        Args: { p_campaign_id: string; p_character_id: string; p_zone: string }
        Returns: {
          campaign_id: string
          character_id: string
          id: string
          updated_at: string
          zone: string
        }
        SetofOptions: {
          from: "*"
          to: "scene_positions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_encounter: {
        Args: { p_campaign_id: string }
        Returns: {
          active_index: number
          campaign_id: string
          combatants: Json
          round_number: number
          started_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "turn_order"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_session: {
        Args: { p_campaign_id: string; p_title?: string }
        Returns: {
          campaign_id: string
          ended_at: string | null
          id: string
          number: number
          paused_at: string | null
          started_at: string
          title: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_clock: {
        Args: {
          p_clock_id: string
          p_description: string
          p_faction_id: string
          p_name: string
          p_revealed: boolean
          p_segments: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          description: string
          faction_id: string | null
          filled: number
          id: string
          name: string
          revealed: boolean
          segments: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_map_marker: {
        Args: {
          p_label?: string
          p_marker_id: string
          p_marker_kind?: string
          p_notes?: string
          p_x?: number
          p_y?: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          label: string
          marker_kind: string
          notes: string | null
          updated_at: string
          x: number
          y: number
        }
        SetofOptions: {
          from: "*"
          to: "campaign_map_markers"
          isOneToOne: true
          isSetofReturn: false
        }
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
