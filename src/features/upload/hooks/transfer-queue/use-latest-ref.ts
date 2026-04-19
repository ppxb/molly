import { useEffect, useRef } from 'react'

export function useLatestRef<TValue>(value: TValue) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}
