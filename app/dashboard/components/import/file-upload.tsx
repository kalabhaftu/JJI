'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { ImportType } from './import-type-selection'
import { Progress } from "@/components/ui/progress"
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, File01Icon, Alert02Icon, UploadCircle01Icon } from '@hugeicons/core-free-icons'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RevealAction } from "@/components/ui/reveal-action"
import { cn } from "@/lib/utils"
import { platforms } from './config/platforms'
import { Step } from './import-button'
import { reportClientError } from '@/lib/observability/report-error'

interface FileUploadProps {
  importType: ImportType
  setRawCsvData: React.Dispatch<React.SetStateAction<string[][]>>
  setCsvData: React.Dispatch<React.SetStateAction<string[][]>>
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>
  setStep: React.Dispatch<React.SetStateAction<Step>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export default function FileUpload({
  importType,
  setRawCsvData,
  setCsvData,
  setHeaders,
  setStep,
  setError
}: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [parsedFiles, setParsedFiles] = useState<string[][][]>([])
  const [rejectedFiles, setRejectedFiles] = useState<File[]>([])
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  const processFile = useCallback((file: File, index: number) => {
    return new Promise<void>((resolve, reject) => {

      const reader = new FileReader();
      reader.onload = (e) => {
        const firstLine = e.target?.result?.toString().split('T')[0] || '';
        const delimiter = firstLine.includes(';') ? ';' : ',';
        
        Papa.parse(file, {
          delimiter,
          complete: (result) => {
            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
              setParsedFiles(prevFiles => {
                const newFiles = [...prevFiles]
                newFiles[index] = result.data as string[][]
                return newFiles
              })
              setError(null)
              resolve()
            } else {
              reject(new Error("The CSV file appears to be empty or invalid."))
            }
          },
          error: (error) => {
            reject(new Error(`Error parsing CSV: ${error.message}`))
          }
        })
      };
      reader.onerror = () => {
        reject(new Error("Error reading file"))
      };
      reader.readAsText(file);
    })
  }, [setError])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (isOffline) {
      setRejectedFiles(acceptedFiles)
      setError('You appear to be offline. Reconnect before importing trades.')
      return
    }
    setUploadedFiles(prevFiles => [...prevFiles, ...acceptedFiles])
    acceptedFiles.forEach((file, index) => {
      const totalIndex = uploadedFiles.length + index
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
      processFile(file, totalIndex)
        .then(() => {
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
        })
        .catch(error => {
          reportClientError(error, { operation: 'parse-import-file', route: '/dashboard/import' })
          setError(error.message)
          setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        })
    })
  }, [processFile, setError, uploadedFiles.length, isOffline])

  const onDropRejected = useCallback((fileRejections: { file: File }[]) => {
    setRejectedFiles(fileRejections.map(rejection => rejection.file))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    onDropRejected,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: true
  })

  const removeFile = (index: number) => {
    setUploadedFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
    setParsedFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      const fileName = uploadedFiles[index]?.name
      if (fileName) {
        delete newProgress[fileName]
      }
      return newProgress
    })
  }

  const clearRejected = () => {
    setRejectedFiles([])
    setError(null)
  }

  const concatenateFiles = useCallback(() => {
    if (parsedFiles.length === 0) return

    try {
      const platform = platforms.find(p => p.type === importType)
      if (!platform) {
        throw new Error("Invalid import type")
      }


      if (!platform.processFile) {
        return
      }

      let concatenatedData: string[][] = []
      let headers: string[] = []

      parsedFiles.forEach((file, index) => {
        const { headers: fileHeaders, processedData } = platform.processFile!(file)
        if (index === 0) {
          headers = fileHeaders
          concatenatedData = processedData
        } else {
          concatenatedData = [...concatenatedData, ...processedData]
        }
      })

      setRawCsvData([headers, ...concatenatedData])
      setCsvData(concatenatedData)
      setHeaders(headers)


      const currentStepIndex = platform.steps.findIndex(step => step.id === 'upload-file')
      const nextStep = platform.steps[currentStepIndex + 1]
      if (currentStepIndex !== -1 && nextStep) {
        setStep(nextStep.id)
      }
      
      setError(null)
    } catch (error) {
      reportClientError(error, { operation: 'combine-import-files', route: '/dashboard/import' })
      setError((error as Error).message)
    }
  }, [importType, parsedFiles, setRawCsvData, setCsvData, setHeaders, setStep, setError])

  useEffect(() => {
    if (parsedFiles.length > 0 && parsedFiles.length === uploadedFiles.length && Object.values(uploadProgress).every(progress => progress === 100)) {
      concatenateFiles()
    }
  }, [parsedFiles, uploadProgress, concatenateFiles, uploadedFiles.length])

  return (
    <div className="space-y-4 w-full h-full flex flex-col items-center justify-center max-w-3xl mx-auto p-4 overflow-y-auto">
      <div 
        {...getRootProps()} 
        data-tour="file-upload-dropzone"
        className={cn(
          "h-64 w-full border border-dashed rounded-2xl p-8 text-center transition-all duration-300 ease-in-out",
          "hover:border-primary/30 group relative bg-card shadow-sm",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[0.99] shadow-md shadow-primary/5" 
            : "border-border hover:bg-muted/5",
          "cursor-pointer flex items-center justify-center"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3.5">
          <div className="relative p-3 rounded-2xl bg-muted border border-border group-hover:scale-105 group-hover:border-primary/25 transition-all duration-300 shadow-sm">
            <HugeiconsIcon 
              icon={UploadCircle01Icon}
              className={cn(
                "h-10 w-10 transition-all duration-300",
                isDragActive 
                  ? "text-primary scale-110 -translate-y-1" 
                  : "text-muted-foreground group-hover:text-primary group-hover:-translate-y-1"
              )} 
            />
          </div>
          {isDragActive ? (
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground animate-in fade-in slide-in-from-bottom-2">
                Drop CSV files here
              </p>
              <p className="text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-3">
                Release your mouse to start importing
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                Upload CSV Files
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag and drop CSV files here, or <span className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">browse files</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2.5 animate-in slide-in-from-bottom-4 duration-500 w-full">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/85 px-1">Uploaded Files</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {uploadedFiles.map((file, index) => (
              <div 
                key={index} 
                className={cn(
                  "flex items-center justify-between border border-border bg-card rounded-xl p-3 hover:border-primary/20",
                  "transition-all duration-200 ease-in-out",
                  "animate-in slide-in-from-bottom fade-in",
                  "group"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="bg-muted p-2 rounded-lg border border-border group-hover:scale-102 transition-transform">
                    <HugeiconsIcon icon={File01Icon} className="h-4 w-4 text-foreground/70" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-foreground/90 truncate max-w-[200px] sm:max-w-[320px]">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {`${(file.size / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Progress 
                    value={uploadProgress[file.name] || 0} 
                    className="w-16 sm:w-24 h-1.5"
                  />
                  <RevealAction
                    size="icon"
                    aria-label={`Remove ${file.name}`}
                    title="Remove file"
                    onClick={() => removeFile(index)}
                    className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                    <span className="sr-only">Remove file</span>
                  </RevealAction>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="flex items-start gap-3 bg-muted/40 border border-border p-3.5 rounded-xl text-xs text-muted-foreground w-full animate-in slide-in-from-bottom-5">
          <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 text-muted-foreground/80 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Note: All uploaded files will be concatenated and processed using the selected import type configuration.
          </p>
        </div>
      )}

      {rejectedFiles.length > 0 && (
        <Alert variant="destructive" className="w-full" data-testid="file-rejection-alert">
          <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4" />
          <AlertTitle>
            {rejectedFiles.length === 1 ? 'This file could not be imported' : 'Some files could not be imported'}
          </AlertTitle>
          <AlertDescription className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              {rejectedFiles.map(file => file.name).join(', ')} — only .csv files are supported.
              {isOffline && ' You appear to be offline. Reconnect before importing trades.'}
            </span>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 text-xs h-8" onClick={clearRejected}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
