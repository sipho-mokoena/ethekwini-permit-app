import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backend } from '../lib/backend'
import { ApplicationInput } from '../lib/types'

export function useApplications(filter?: {
  ownerId?: string
  offset?: number
  limit?: number
  sort?: string
}) {
  return useQuery({
    queryKey: ['applications', filter],
    queryFn: () => backend.db.listApplications(filter),
  })
}

export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: ['applications', applicationId],
    queryFn: () => backend.db.getApplication(applicationId),
    enabled: !!applicationId,
  })
}

export function useCreateApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (application: ApplicationInput) =>
      backend.db.createApplication(application),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string
      status: 'reviewing' | 'approved' | 'rejected'
    }) => backend.db.updateApplicationStatus(applicationId, status),
    onSuccess: (_, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
    },
  })
}

export function useUploadedDocuments(applicationId: string) {
  return useQuery({
    queryKey: ['uploaded-documents', applicationId],
    queryFn: () => backend.db.listUploadedDocuments(applicationId),
    enabled: !!applicationId,
  })
}

export function useCreateUploadedDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: backend.db.createUploadedDocument,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['uploaded-documents', variables.applicationId],
      })
    },
  })
}