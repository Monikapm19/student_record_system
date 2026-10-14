import { useEffect, useState } from 'react'
import './App.css'
import { api } from './api/client'

function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/health')
      .then((result) => setHealth(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main style={{ maxWidth: '800px', margin: '80px auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Student Record System</h1>
      <p>Manage student information through a centralized system.</p>

      <section style={{ marginTop: '32px', padding: '24px', border: '1px solid #ccc', borderRadius: '12px' }}>
        <h2>Backend Connection</h2>

        {loading && <p>Checking backend connection...</p>}

        {!loading && health && (
          <div>
            <p>API Status: <strong>{health.status}</strong></p>
            <p>Service: {health.service}</p>
          </div>
        )}

        {!loading && error && (
          <p style={{ color: 'red' }}>Connection failed: {error}</p>
        )}
      </section>
    </main>
  )
}

export default App