export type Role = 'ADMIN' | 'SALES' | 'FINANCE';

export interface User {
  id: string;
  userId?: string;
  email: string;
  name: string;
  phone?: string;
  designation?: string;
  role: Role;
  status?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
