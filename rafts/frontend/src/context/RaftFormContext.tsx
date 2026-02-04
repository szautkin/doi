/*
 ************************************************************************
 *******************  CANADIAN ASTRONOMY DATA CENTRE  *******************
 **************  CENTRE CANADIEN DE DONNÉES ASTRONOMIQUES  **************
 *
 *  (c) 2026.                            (c) 2026.
 *  Government of Canada                 Gouvernement du Canada
 *  National Research Council            Conseil national de recherches
 *  Ottawa, Canada, K1A 0R6              Ottawa, Canada, K1A 0R6
 *  All rights reserved                  Tous droits réservés
 *
 *  NRC disclaims any warranties,        Le CNRC dénie toute garantie
 *  expressed, implied, or               énoncée, implicite ou légale,
 *  statutory, of any kind with          de quelque nature que ce
 *  respect to the software,             soit, concernant le logiciel,
 *  including without limitation         y compris sans restriction
 *  any warranty of merchantability      toute garantie de valeur
 *  or fitness for a particular          marchande ou de pertinence
 *  purpose. NRC shall not be            pour un usage particulier.
 *  liable in any event for any          Le CNRC ne pourra en aucun cas
 *  damages, whether direct or           être tenu responsable de tout
 *  indirect, special or general,        dommage, direct ou indirect,
 *  consequential or incidental,         particulier ou général,
 *  arising from the use of the          accessoire ou fortuit, résultant
 *  software.  Neither the name          de l'utilisation du logiciel. Ni
 *  of the National Research             le nom du Conseil National de
 *  Council of Canada nor the            Recherches du Canada ni les noms
 *  names of its contributors may        de ses  participants ne peuvent
 *  be used to endorse or promote        être utilisés pour approuver ou
 *  products derived from this           promouvoir les produits dérivés
 *  software without specific prior      de ce logiciel sans autorisation
 *  written permission.                  préalable et particulière
 *                                       par écrit.
 *
 *  This file is part of the             Ce fichier fait partie du projet
 *  OpenCADC project.                    OpenCADC.
 *
 *  OpenCADC is free software:           OpenCADC est un logiciel libre ;
 *  you can redistribute it and/or       vous pouvez le redistribuer ou le
 *  modify it under the terms of         modifier suivant les termes de
 *  the GNU Affero General Public        la "GNU Affero General Public
 *  License as published by the          License" telle que publiée
 *  Free Software Foundation,            par la Free Software Foundation
 *  either version 3 of the              : soit la version 3 de cette
 *  License, or (at your option)         licence, soit (à votre gré)
 *  any later version.                   toute version ultérieure.
 *
 *  OpenCADC is distributed in the       OpenCADC est distribué
 *  hope that it will be useful,         dans l'espoir qu'il vous
 *  but WITHOUT ANY WARRANTY;            sera utile, mais SANS AUCUNE
 *  without even the implied             GARANTIE : sans même la garantie
 *  warranty of MERCHANTABILITY          implicite de COMMERCIALISABILITÉ
 *  or FITNESS FOR A PARTICULAR          ni d'ADÉQUATION À UN OBJECTIF
 *  PURPOSE.  See the GNU Affero         PARTICULIER. Consultez la Licence
 *  General Public License for           Générale Publique GNU Affero
 *  more details.                        pour plus de détails.
 *
 *  You should have received             Vous devriez avoir reçu une
 *  a copy of the GNU Affero             copie de la Licence Générale
 *  General Public License along         Publique GNU Affero avec
 *  with OpenCADC.  If not, see          OpenCADC ; si ce n'est
 *  <http://www.gnu.org/licenses/>.      pas le cas, consultez :
 *                                       <http://www.gnu.org/licenses/>.
 *
 ************************************************************************
 */

'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { clearRaftData, loadRaftData, saveRaftData } from '@/utilities/localStorage'
import {
  OPTION_DRAFT,
  OPTION_REVIEW,
  PROP_AUTHOR_INFO,
  PROP_GENERAL_INFO,
  PROP_MISC_INFO,
  PROP_OBSERVATION_INFO,
  PROP_TECHNICAL_INFO,
  PROP_STATUS,
} from '@/shared/constants'
import { TRaftStatus, TRaftSubmission, TSection } from '@/shared/model'
import { VALIDATION_SCHEMAS } from '@/context/constants'
import { validateWithSchema, getValidationErrors } from '@/utilities/validation'
import { TRaftContext } from '@/context/types'
import { submitDOI } from '@/actions/submitDOI'
import { updateDOI } from '@/actions/updateDOI'
import { IResponseData } from '@/actions/types'

// Define a type that recursively converts all leaf values to string
type RecursiveStringify<T> = T extends object
  ? { [K in keyof T]?: RecursiveStringify<T[K]> }
  : string

// Initial empty state structure
const initialRaftState: TRaftContext | null = null

// Define context type
interface RaftFormContextType {
  raftData: TRaftContext | null
  isLoading: boolean
  updateRaftSection: (section: string, data: TSection) => void
  resetForm: () => void
  setFormFromFile: (data: TRaftContext) => void
  submitForm: (isDraft: boolean, formData?: TRaftContext) => Promise<IResponseData<string>>
  isSubmitting: boolean
  isSectionCompleted: (section: keyof typeof VALIDATION_SCHEMAS) => boolean
  allSectionsCompleted: boolean
  errors: RecursiveStringify<TRaftSubmission>
  setRaftErrors: (section: keyof typeof VALIDATION_SCHEMAS) => void
  /** DOI identifier for attachment uploads (available after first save) */
  doiIdentifier: string | null
}

// Create context
const RaftFormContext = createContext<RaftFormContextType | undefined>(undefined)

interface RaftFormProviderProps {
  children: ReactNode
  initialRaftData?: TRaftContext | null
  useLocalStorage?: boolean
}

// Provider component
export function RaftFormProvider({
  children,
  initialRaftData = null,
  useLocalStorage = true,
}: RaftFormProviderProps) {
  const [raftData, setRaftData] = useState<TRaftContext | null>(initialRaftData || initialRaftState)
  const [isLoading, setIsLoading] = useState(initialRaftData === null && useLocalStorage)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<RecursiveStringify<TRaftSubmission>>({})
  // DOI identifier for attachment uploads - derived from raftData.id or set after first save
  const [doiIdentifier, setDoiIdentifier] = useState<string | null>(initialRaftData?.id || null)

  // Load saved data on initial render if no initialRaftData was provided
  useEffect(() => {
    const loadData = async () => {
      if (initialRaftData) {
        // If initialRaftData is provided, use it directly
        setRaftData(initialRaftData)
        // Sync doiIdentifier with the id from initial data
        if (initialRaftData.id) {
          setDoiIdentifier(initialRaftData.id)
        }
        setIsLoading(false)
      } else if (useLocalStorage) {
        // Otherwise try to load from localStorage if enabled
        const savedData = loadRaftData()
        if (savedData) {
          setRaftData(savedData)
          // Sync doiIdentifier with saved data
          if (savedData.id) {
            setDoiIdentifier(savedData.id)
          }
        }
        setIsLoading(false)
      } else {
        // Neither initialRaftData nor localStorage - just start with empty state
        setIsLoading(false)
      }
    }

    loadData()
  }, [initialRaftData, useLocalStorage])

  // Update a section of the form
  const updateRaftSection = useCallback(
    (section: string, data: TSection) => {
      setRaftData((prevState) => {
        const newState: TRaftContext = {
          ...(prevState ? prevState : {}),
          [section]: data,
        }

        // Save to localStorage after state update if enabled
        if (useLocalStorage) {
          saveRaftData(newState)
        }

        return newState
      })
    },
    [useLocalStorage],
  )

  // Reset the entire form
  const resetForm = useCallback(() => {
    if (useLocalStorage) {
      clearRaftData()
    }
    setRaftData(initialRaftData || initialRaftState)
  }, [initialRaftData, useLocalStorage])

  // Set form from file
  // Important: Strip the 'id' field to ensure importing creates a NEW RAFT
  // This prevents accidentally updating an old RAFT when importing exported data
  const setFormFromFile = useCallback((formData: TRaftContext) => {
    if (formData) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _removedId, ...dataWithoutId } = formData
      setRaftData(dataWithoutId)
      // Also clear the doiIdentifier since this is a new RAFT
      setDoiIdentifier(null)
    }
  }, [])

  // Submit the form
  // formData parameter allows passing synced data directly to avoid async state race condition
  const submitForm = useCallback(
    async (isDraft: boolean, formData?: TRaftContext) => {
      try {
        setIsSubmitting(true)

        // Use passed formData if provided, otherwise fall back to raftData from context
        const dataToSubmit = formData || raftData

        // Determine the status to set
        const newStatus = (isDraft ? OPTION_DRAFT : OPTION_REVIEW) as TRaftStatus

        // Create final submission object with status in generalInfo
        const finalSubmission: TRaftContext = {
          ...dataToSubmit,
          [PROP_GENERAL_INFO]: {
            ...(dataToSubmit?.[PROP_GENERAL_INFO] || {}),
            [PROP_STATUS]: newStatus,
          } as TRaftContext[typeof PROP_GENERAL_INFO],
        }

        let result

        if (finalSubmission?.id) {
          result = await updateDOI(finalSubmission, finalSubmission?.id)
        } else {
          result = await submitDOI(finalSubmission)
        }

        // After successful submit, extract and store DOI identifier
        if (result?.success && result.data) {
          // For new submissions, result.data is the DOI URL (e.g., https://...doi/instances/25.0047)
          // Extract the identifier from the URL
          const identifier = typeof result.data === 'string' ? result.data.split('/').pop() : null

          if (identifier && !finalSubmission?.id) {
            // Update the doiIdentifier state
            setDoiIdentifier(identifier)

            // Update raftData to include the id for future saves
            setRaftData((prev) => (prev ? { ...prev, id: identifier } : prev))

            console.log('[submitForm] DOI created:', identifier)
          }
        }

        // Clear draft after successful submission if using localStorage
        if (result?.success && useLocalStorage) {
          clearRaftData()
        }

        return result
      } catch (error) {
        console.error('Error submitting RAFT:', error)
        throw error
      } finally {
        setIsSubmitting(false)
      }
    },
    [raftData, useLocalStorage],
  )

  // Check if a section is completed
  const isSectionCompleted = useCallback(
    (section: keyof typeof VALIDATION_SCHEMAS) => {
      return raftData?.[section]
        ? validateWithSchema(VALIDATION_SCHEMAS[section], raftData?.[section])
        : false
    },
    [raftData],
  )

  // Set errors for a specific section
  const setRaftErrors = useCallback(
    (section: keyof typeof VALIDATION_SCHEMAS) => {
      setErrors((prevErrors) => ({
        ...prevErrors,
        [section]: raftData?.[section]
          ? getValidationErrors(VALIDATION_SCHEMAS[section], raftData?.[section])
          : undefined,
      }))
    },
    [raftData],
  )

  // Check if all sections are completed
  const allSectionsCompleted = [
    PROP_GENERAL_INFO,
    PROP_AUTHOR_INFO,
    PROP_OBSERVATION_INFO,
    PROP_TECHNICAL_INFO,
    PROP_MISC_INFO,
  ].every((section) => isSectionCompleted(section as keyof typeof VALIDATION_SCHEMAS))

  // Create context value
  const contextValue: RaftFormContextType = {
    raftData,
    isLoading,
    updateRaftSection,
    resetForm,
    setFormFromFile,
    submitForm,
    isSubmitting,
    isSectionCompleted,
    allSectionsCompleted,
    errors,
    setRaftErrors,
    doiIdentifier,
  }

  return <RaftFormContext.Provider value={contextValue}>{children}</RaftFormContext.Provider>
}

// Custom hook to use the context
export function useRaftForm() {
  const context = useContext(RaftFormContext)
  if (context === undefined) {
    throw new Error('useRaftForm must be used within a RaftFormProvider')
  }
  return context
}
