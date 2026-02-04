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

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react'
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
import { validateWithSchema } from '@/utilities/validation'
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

// Split context interfaces for better performance
interface RaftDataContextType {
  raftData: TRaftContext | null
  updateRaftSection: (section: string, data: TSection) => void
  resetForm: () => void
  setFormFromFile: (data: TRaftContext) => void
}

interface RaftValidationContextType {
  isSectionCompleted: (section: keyof typeof VALIDATION_SCHEMAS) => boolean
  allSectionsCompleted: boolean
  errors: RecursiveStringify<TRaftSubmission>
  setRaftErrors: (section: keyof typeof VALIDATION_SCHEMAS) => void
}

interface RaftSubmissionContextType {
  submitForm: (isDraft: boolean) => Promise<IResponseData<string>>
  isSubmitting: boolean
}

interface RaftLoadingContextType {
  isLoading: boolean
}

// Create separate contexts
const RaftDataContext = createContext<RaftDataContextType | undefined>(undefined)
const RaftValidationContext = createContext<RaftValidationContextType | undefined>(undefined)
const RaftSubmissionContext = createContext<RaftSubmissionContextType | undefined>(undefined)
const RaftLoadingContext = createContext<RaftLoadingContextType | undefined>(undefined)

interface RaftFormProviderProps {
  children: ReactNode
  initialRaftData?: TRaftContext | null
  useLocalStorage?: boolean
}

// Optimized Provider component
export function RaftFormProviderOptimized({
  children,
  initialRaftData = null,
  useLocalStorage = true,
}: RaftFormProviderProps) {
  const [raftData, setRaftData] = useState<TRaftContext | null>(initialRaftData || initialRaftState)
  const [isLoading, setIsLoading] = useState(initialRaftData === null && useLocalStorage)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<RecursiveStringify<TRaftSubmission>>({})

  // Load saved data on initial render if no initialRaftData was provided
  useEffect(() => {
    const loadData = async () => {
      if (initialRaftData) {
        setRaftData(initialRaftData)
        setIsLoading(false)
      } else if (useLocalStorage) {
        const savedData = loadRaftData()
        if (savedData) {
          setRaftData(savedData)
        }
        setIsLoading(false)
      } else {
        setIsLoading(false)
      }
    }

    loadData()
  }, [initialRaftData, useLocalStorage])

  // Update a section of the form with debounced localStorage save
  const updateRaftSection = useCallback(
    (section: string, data: TSection) => {
      setRaftData((prevState) => {
        const newState: TRaftContext = {
          ...(prevState ? prevState : {}),
          [section]: data,
        }

        // Debounce localStorage save to reduce writes
        if (useLocalStorage) {
          setTimeout(() => {
            saveRaftData(newState)
          }, 500)

          return newState
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
  const setFormFromFile = useCallback((formData: TRaftContext) => {
    if (formData) {
      setRaftData(formData)
    }
  }, [])

  // Submit the form
  const submitForm = useCallback(
    async (isDraft: boolean) => {
      try {
        setIsSubmitting(true)

        const finalSubmission = {
          ...raftData,
          [PROP_STATUS]: (isDraft ? OPTION_DRAFT : OPTION_REVIEW) as TRaftStatus,
        }

        let result

        if (finalSubmission?.id) {
          result = await updateDOI(finalSubmission, finalSubmission?.id)
        } else {
          result = await submitDOI(finalSubmission)
        }

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

  // Check if a section is completed - memoized for performance
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
          ? validateWithSchema(VALIDATION_SCHEMAS[section], raftData?.[section])
          : undefined,
      }))
    },
    [raftData],
  )

  // Check if all sections are completed - memoized
  const allSectionsCompleted = useMemo(() => {
    return [
      PROP_GENERAL_INFO,
      PROP_AUTHOR_INFO,
      PROP_OBSERVATION_INFO,
      PROP_TECHNICAL_INFO,
      PROP_MISC_INFO,
    ].every((section) => isSectionCompleted(section as keyof typeof VALIDATION_SCHEMAS))
  }, [isSectionCompleted])

  // Create memoized context values
  const dataContextValue = useMemo<RaftDataContextType>(
    () => ({
      raftData,
      updateRaftSection,
      resetForm,
      setFormFromFile,
    }),
    [raftData, updateRaftSection, resetForm, setFormFromFile],
  )

  const validationContextValue = useMemo<RaftValidationContextType>(
    () => ({
      isSectionCompleted,
      allSectionsCompleted,
      errors,
      setRaftErrors,
    }),
    [isSectionCompleted, allSectionsCompleted, errors, setRaftErrors],
  )

  const submissionContextValue = useMemo<RaftSubmissionContextType>(
    () => ({
      submitForm,
      isSubmitting,
    }),
    [submitForm, isSubmitting],
  )

  const loadingContextValue = useMemo<RaftLoadingContextType>(
    () => ({
      isLoading,
    }),
    [isLoading],
  )

  return (
    <RaftLoadingContext.Provider value={loadingContextValue}>
      <RaftDataContext.Provider value={dataContextValue}>
        <RaftValidationContext.Provider value={validationContextValue}>
          <RaftSubmissionContext.Provider value={submissionContextValue}>
            {children}
          </RaftSubmissionContext.Provider>
        </RaftValidationContext.Provider>
      </RaftDataContext.Provider>
    </RaftLoadingContext.Provider>
  )
}

// Custom hooks to use the separate contexts
export function useRaftData() {
  const context = useContext(RaftDataContext)
  if (context === undefined) {
    throw new Error('useRaftData must be used within a RaftFormProvider')
  }
  return context
}

export function useRaftValidation() {
  const context = useContext(RaftValidationContext)
  if (context === undefined) {
    throw new Error('useRaftValidation must be used within a RaftFormProvider')
  }
  return context
}

export function useRaftSubmission() {
  const context = useContext(RaftSubmissionContext)
  if (context === undefined) {
    throw new Error('useRaftSubmission must be used within a RaftFormProvider')
  }
  return context
}

export function useRaftLoading() {
  const context = useContext(RaftLoadingContext)
  if (context === undefined) {
    throw new Error('useRaftLoading must be used within a RaftFormProvider')
  }
  return context
}

// Compatibility hook that combines all contexts (use sparingly)
export function useRaftFormOptimized() {
  const data = useRaftData()
  const validation = useRaftValidation()
  const submission = useRaftSubmission()
  const loading = useRaftLoading()

  return {
    ...data,
    ...validation,
    ...submission,
    ...loading,
  }
}
