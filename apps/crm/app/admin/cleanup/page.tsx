'use client'

import { useState, useEffect } from 'react'

type CompanyWithRelations = {
  id: string
  name: string
  created_at: string
  relations: {
    relationship_type: string
    person: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string | null
    } | null
  }[]
}

export default function CleanupPage() {
  const [companies, setCompanies] = useState<CompanyWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    try {
      const res = await fetch('/api/cleanup-duplicates')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setCompanies(data.companies || [])
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function deleteCompany(companyId: string) {
    if (!confirm('Are you sure you want to delete this company and all its relations?')) {
      return
    }

    setDeleting(companyId)
    try {
      const res = await fetch('/api/cleanup-duplicates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId })
      })
      const data = await res.json()
      if (data.error) {
        alert('Error: ' + data.error)
      } else {
        alert('Deleted successfully!')
        fetchCompanies()
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
    setDeleting(null)
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Cleanup Duplicate Companies</h1>

      <p className="mb-4 text-gray-600">
        Found {companies.length} Quantum Gardens companies. Delete the one that doesn't have the correct founders.
      </p>

      <div className="space-y-6">
        {companies.map((company) => (
          <div key={company.id} className="border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold">{company.name}</h2>
                <p className="text-sm text-gray-500">ID: {company.id}</p>
                <p className="text-sm text-gray-500">Created: {new Date(company.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => deleteCompany(company.id)}
                disabled={deleting === company.id}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting === company.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Related People ({company.relations.length}):
              </h3>
              {company.relations.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No people linked to this company</p>
              ) : (
                <ul className="space-y-1">
                  {company.relations.map((rel, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">
                        {rel.person?.first_name} {rel.person?.last_name}
                      </span>
                      <span className="text-gray-500"> ({rel.person?.email})</span>
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {rel.relationship_type}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
