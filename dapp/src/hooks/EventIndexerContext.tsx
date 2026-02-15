import { createContext, useContext, type ReactNode } from 'react'
import { useEventIndexer } from './useEventIndexer'
import { type CachedEvent } from '../libs/eventCache'

interface EventIndexerContextValue {
  events: CachedEvent[]
  loading: boolean
  lastBlock: number
  refetch: () => void
}

const EventIndexerContext = createContext<EventIndexerContextValue>({
  events: [],
  loading: false,
  lastBlock: 0,
  refetch: () => {},
})

export function EventIndexerProvider({ children }: { children: ReactNode }) {
  const indexer = useEventIndexer()
  return (
    <EventIndexerContext.Provider value={indexer}>
      {children}
    </EventIndexerContext.Provider>
  )
}

export function useEvents(): EventIndexerContextValue {
  return useContext(EventIndexerContext)
}
