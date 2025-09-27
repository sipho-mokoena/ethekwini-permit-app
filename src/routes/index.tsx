import { createFileRoute, redirect } from '@tanstack/react-router'
import { backend } from '../lib/backend'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await backend.auth.getCurrentUser()
    
    if (!user) {
      throw redirect({ to: '/login' })
    }
    
    if (user.isAdmin) {
      throw redirect({ to: '/admin/applications' })
    }
    
    throw redirect({ to: '/dashboard' })
  },
})