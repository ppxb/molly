'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [message, setMessage] = useState()

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/hello')
      const { message } = await res.json()
      setMessage(message)
    }
    void fetchData()
  }, [])

  if (!message) return <p>Loading...</p>

  return <p className="text-4xl text-green-500">{message}</p>
}
