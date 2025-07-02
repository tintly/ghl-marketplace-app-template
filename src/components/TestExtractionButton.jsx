import React, { useState } from 'react'
import ExtractionResultsDialog from './data-extraction/ExtractionResultsDialog'

function TestExtractionButton({ user, authService }) {
  const [testing, setTesting] = useState(false)
  const [extractionResult, setExtractionResult] = useState(null)
  const [showResults, setShowResults] = useState(false)

  const runTestExtraction = async () => {
    try {
      setTesting(true)
      console.log('Running test extraction...')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/test-openai-extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          conversation_id: 's5QLyA8BsRzGman0LYAw' // Default test conversation
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Test extraction failed')
      }

      const result = await response.json()
      console.log('Test extraction completed:', result)
      
      // Transform the result to match our dialog expectations
      const transformedResult = {
        success: result.test_steps?.openai_extraction?.success || false,
        extracted_data: result.extracted_data || {},
        usage: result.test_steps?.openai_extraction || {},
        contact_update: result.contact_update,
        conversation_id: result.conversation_id,
        location_id: result.location_id,
        timestamp: result.timestamp
      }

      // Check if contact update had conflicts
      if (result.contact_update && !result.contact_update.success && result.contact_update.requires_confirmation) {
        transformedResult.requires_confirmation = true
        transformedResult.conflicts = result.contact_update.conflicts
        transformedResult.contact_id = result.contact_update.contact_id
      } else if (result.contact_update && result.contact_update.success) {
        transformedResult.updated_fields = result.contact_update.updated_fields || []
        transformedResult.skipped_fields = result.contact_update.skipped_fields || []
      }

      setExtractionResult(transformedResult)
      setShowResults(true)

    } catch (error) {
      console.error('Test extraction error:', error)
      setExtractionResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      setShowResults(true)
    } finally {
      setTesting(false)
    }
  }

  const handleRetryWithResolution = async (forceOverwrite) => {
    try {
      setTesting(true)
      console.log('Retrying extraction with conflict resolution:', forceOverwrite)

      // Call update-ghl-contact directly with force overwrite
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/update-ghl-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          ghl_contact_id: extractionResult.contact_id,
          location_id: extractionResult.location_id,
          extracted_data: extractionResult.extracted_data,
          force_overwrite: forceOverwrite
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Contact update failed')
      }

      const result = await response.json()
      console.log('Contact update completed:', result)

      // Update the extraction result
      setExtractionResult(prev => ({
        ...prev,
        success: result.success,
        updated_fields: result.updated_fields || [],
        skipped_fields: result.skipped_fields || [],
        requires_confirmation: false,
        conflicts: null
      }))

    } catch (error) {
      console.error('Retry extraction error:', error)
      setExtractionResult(prev => ({
        ...prev,
        success: false,
        error: error.message,
        requires_confirmation: false
      }))
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test AI Extraction</h3>
        <p className="text-sm text-gray-600 mb-4">
          Test the complete extraction pipeline with a sample conversation to see how overwrite policies work.
        </p>
        
        <button
          onClick={runTestExtraction}
          disabled={testing}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-md transition-colors flex items-center"
        >
          {testing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Testing Extraction...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Test Extraction
            </>
          )}
        </button>
      </div>

      {/* Results Dialog */}
      {showResults && extractionResult && (
        <ExtractionResultsDialog
          extractionResult={extractionResult}
          onClose={() => setShowResults(false)}
          onRetryWithResolution={handleRetryWithResolution}
          authService={authService}
        />
      )}
    </>
  )
}

export default TestExtractionButton