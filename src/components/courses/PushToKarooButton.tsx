'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'

import { apiFetch, fetcher } from '@/lib/api'
import type { IntegrationsStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

interface RouteState {
  route_id: string | null
  updated?: boolean
}

/**
 * Send a course to the athlete's Hammerhead Karoo as a route (openkoutsi#69).
 *
 * Route sync is push-only: the course's own GPX goes to the athlete's own
 * device account, and pressing it again replaces that route rather than adding
 * a second one. Shown only once Hammerhead is connected.
 */
export function PushToKarooButton({ courseId }: { courseId: string }) {
  const t = useTranslations('courses')
  const { data: integrations } = useSWR<IntegrationsStatus>('/api/integrations/status', fetcher)
  const connected = integrations?.connected?.includes('hammerhead') ?? false
  const [pushing, setPushing] = useState(false)
  const { data, mutate } = useSWR<RouteState>(
    connected ? `/api/courses/${courseId}/push/hammerhead` : null,
    fetcher,
  )

  if (!connected) return null

  const pushed = Boolean(data?.route_id)

  async function push() {
    setPushing(true)
    try {
      const res = await apiFetch<RouteState>(`/api/courses/${courseId}/push/hammerhead`, {
        method: 'POST',
      })
      await mutate(res, { revalidate: false })
      toast({ title: res.updated ? t('karoo.updated') : t('karoo.sent') })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      toast({
        title: t('karoo.failed'),
        description: msg.includes('insufficient_scope') ? t('karoo.reconnect') : msg || undefined,
        variant: 'destructive',
      })
    } finally {
      setPushing(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={push}
      disabled={pushing}
      data-testid="push-to-karoo"
    >
      <Send className="mr-1.5 h-3.5 w-3.5" />
      {pushing ? t('karoo.sending') : pushed ? t('karoo.resend') : t('karoo.send')}
    </Button>
  )
}
