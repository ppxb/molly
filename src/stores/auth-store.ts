import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { initApiClient } from '@/lib/api/client'
import type { LoginResp } from '@/lib/api/types'

type AuthUser = Omit<LoginResp, 'token'>

interface AuthState {
  token: string | null
  user: AuthUser | null
}

interface AuthActions {
  setAuth: (resp: LoginResp) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    set => ({
      token: null,
      user: null,

      setAuth: ({ token, ...user }) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null })
    }),
    {
      name: 'molly-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({ token: s.token, user: s.user })
    }
  )
)

initApiClient(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().clearAuth()
)

export const selectIsAuthenticated = (s: AuthState) => !!s.token
export const selectUser = (s: AuthState) => s.user
