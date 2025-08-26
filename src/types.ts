// Types für Supplement Stack

export interface CloudflareBindings {
  DB: D1Database;
}

// User Types
export interface User {
  id: number;
  email: string;
  name?: string;
  alter?: number;
  geschlecht?: 'm' | 'w' | 'd';
  gewicht?: number;
  ernaehrungsweise?: string;
  ziele?: string;
  guideline_quelle: 'DGE' | 'Studien' | 'Influencer';
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
  alter?: number;
  geschlecht?: 'm' | 'w' | 'd';
  gewicht?: number;
  ernaehrungsweise?: string;
  ziele?: string;
  guideline_quelle?: 'DGE' | 'Studien' | 'Influencer';
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Wirkstoff Types
export interface Wirkstoff {
  id: number;
  name: string;
  einheit: string;
  beschreibung?: string;
  hypo_symptome?: string;
  hyper_symptome?: string;
  external_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WirkstoffSynonym {
  id: number;
  wirkstoff_id: number;
  synonym: string;
  created_at: string;
}

export interface WirkstoffForm {
  id: number;
  wirkstoff_id: number;
  name: string;
  kommentar?: string;
  tags?: string;
  score: number;
  created_at: string;
}

// Produkt Types
export interface Produkt {
  id: number;
  name: string;
  marke?: string;
  form?: string;
  preis: number;
  einheit_anzahl: number;
  einheit_text: string;
  shop_link?: string;
  affiliate_link?: string;
  bild_url?: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  sichtbarkeit: boolean;
  einreichung_user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ProduktWirkstoff {
  id: number;
  produkt_id: number;
  wirkstoff_id: number;
  ist_hauptwirkstoff: boolean;
  menge: number;
  einheit: string;
  form_id?: number;
  created_at: string;
}

export interface ProduktDetails extends Produkt {
  wirkstoffe: Array<{
    wirkstoff: Wirkstoff;
    menge: number;
    einheit: string;
    ist_hauptwirkstoff: boolean;
    form?: WirkstoffForm;
  }>;
  hauptwirkstoffe: Array<{
    wirkstoff: Wirkstoff;
    menge: number;
    einheit: string;
    form?: WirkstoffForm;
  }>;
  preis_pro_tag?: number;
  preis_pro_monat?: number;
}

export interface CreateProduktRequest {
  name: string;
  marke?: string;
  form?: string;
  preis: number;
  einheit_anzahl?: number;
  einheit_text?: string;
  shop_link?: string;
  bild_url?: string;
  wirkstoffe: Array<{
    wirkstoff_id: number;
    ist_hauptwirkstoff: boolean;
    menge: number;
    einheit?: string;
    form_id?: number;
  }>;
}

// Stack Types
export interface Stack {
  id: number;
  user_id?: number;
  name: string;
  beschreibung?: string;
  is_demo: boolean;
  demo_session_key?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface StackProdukt {
  id: number;
  stack_id: number;
  produkt_id: number;
  dosierung: number;
  einnahmezeit?: string;
  notiz?: string;
  created_at: string;
}

export interface StackDetails extends Stack {
  produkte: Array<{
    stack_produkt: StackProdukt;
    produkt: ProduktDetails;
  }>;
  gesamtpreis_monat: number;
  wirkstoff_summen: Array<{
    wirkstoff: Wirkstoff;
    gesamtmenge: number;
    einheit: string;
    produkte: string[];
  }>;
  interaktionen: WirkstoffInteraktion[];
}

// Empfehlungen
export interface WirkstoffEmpfehlung {
  id: number;
  wirkstoff_id: number;
  produkt_id: number;
  typ: 'empfohlen' | 'alternative';
  reihenfolge: number;
  kommentar?: string;
  created_at: string;
}

// Interaktionen
export interface WirkstoffInteraktion {
  id: number;
  wirkstoff_a_id: number;
  wirkstoff_b_id: number;
  typ: 'warnung' | 'vorsicht' | 'positiv' | 'neutral';
  kommentar: string;
  schwere: 'niedrig' | 'mittel' | 'hoch';
  created_at: string;
  wirkstoff_a?: Wirkstoff;
  wirkstoff_b?: Wirkstoff;
}

// Wunschliste
export interface Wunschliste {
  id: number;
  user_id: number;
  produkt_id: number;
  notiz?: string;
  created_at: string;
  produkt?: ProduktDetails;
}

// Demo Session
export interface DemoSession {
  id: number;
  session_key: string;
  stack_json?: string;
  created_at: string;
  expires_at: string;
  last_accessed: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SearchParams extends PaginationParams {
  query?: string;
  wirkstoff_id?: number;
  marke?: string;
  form?: string;
  price_min?: number;
  price_max?: number;
}

// Modal States
export interface ModalState {
  isOpen: boolean;
  step: 1 | 2 | 3; // 1=Wirkstoff, 2=Produkt, 3=Dosierung
  wirkstoff?: Wirkstoff;
  produkt?: ProduktDetails;
  stack_id?: number;
}

// Frontend State
export interface AppState {
  user?: User;
  currentStack?: StackDetails;
  modal: ModalState;
  isDemo: boolean;
  demoSessionKey?: string;
}