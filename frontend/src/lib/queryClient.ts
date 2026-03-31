import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 daqiqa cache
      retry: 1,                         // xato bo'lsa 1 marta qayta urinish
      refetchOnWindowFocus: true,       // sahifa aktiv bo'lganda yangilash
    },
    mutations: {
      retry: 0,
    },
  },
})
