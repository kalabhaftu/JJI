'use client'

import * as React from 'react'
import { useDropzone, DropzoneOptions } from 'react-dropzone'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, File01Icon, FileUploadIcon, InformationCircleIcon, Upload01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface FileDropzoneProps extends Omit<DropzoneOptions, 'onDrop'> {
    onDrop: (files: File[]) => void
    className?: string
    variant?: 'default' | 'mini'
    description?: string
    icon?: React.ReactNode
    value?: File | null
    onClear?: () => void
    isLoading?: boolean
}

export function FileDropzone({
    onDrop,
    className,
    variant = 'default',
    description,
    icon,
    value,
    onClear,
    isLoading,
    ...dropzoneProps
}: FileDropzoneProps) {
    const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
        onDrop,
        multiple: false,
        ...dropzoneProps,
    })

    if (variant === 'mini') {
        return (
            <div
                {...getRootProps()}
                className={cn(
                    "relative flex items-center justify-center w-full h-full cursor-pointer transition-all duration-200 border-2 border-dashed rounded-lg overflow-hidden",
                    isDragActive ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50 hover:bg-muted/50",
                    isDragReject && "border-destructive bg-destructive/10",
                    isLoading && "pointer-events-none opacity-50",
                    className
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center p-2 text-center space-y-1">
                    {icon || <HugeiconsIcon icon={Upload01Icon} className={cn("h-4 w-4", isDragActive ? "text-primary" : "text-muted-foreground/40")} strokeWidth={1.5} color="currentColor" />}
                    {isDragActive && (
                <span className="text-xs font-medium text-primary">Drop</span>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={cn("w-full space-y-2", className)}>
            <div
                {...getRootProps()}
                className={cn(
                    "relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed p-10 transition-all duration-200 cursor-pointer",
                    isDragActive
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                        : "border-border/40 hover:border-primary/40 hover:bg-muted/30 bg-muted/10",
                    isDragReject && "border-destructive bg-destructive/5",
                    value && !isDragActive && "border-long/30 bg-long/5",
                    isLoading && "pointer-events-none opacity-50",
                    className
                )}
            >
                <input {...getInputProps()} />

                {value ? (
                    <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 bg-background rounded-full shadow-sm mb-3 relative group">
                            {}
                            <HugeiconsIcon icon={File01Icon} className="h-8 w-8 text-primary" strokeWidth={1.5} color="currentColor" />

                            {}
                            {onClear && (
                                <button
                                    type="button"
                                    aria-label={`Remove ${value.name}`}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onClear()
                                    }}
                                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-100 shadow-md transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" strokeWidth={1.5} color="currentColor" />
                                </button>
                            )}
                        </div>
                        <p className="text-sm font-medium text-foreground">{value.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {(value.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {!isLoading && (
                                    <p className="text-xs text-muted-foreground/60 mt-3 border-b border-dashed border-border/50 pb-0.5">
                                Click or drag to replace
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center">
                        <div className={cn(
                            "p-4 rounded-full mb-4 transition-colors",
                            isDragActive ? "bg-primary/20" : "bg-muted/40"
                        )}>
                            {icon || (
                                isDragActive ? <HugeiconsIcon icon={FileUploadIcon} className="h-8 w-8 text-primary" strokeWidth={1.5} color="currentColor" /> : <HugeiconsIcon icon={Upload01Icon} className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} color="currentColor" />
                            )}
                        </div>

                        {isDragActive ? (
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-primary">Drop file here</p>
                                <p className="text-xs text-muted-foreground">Release to upload</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">
                                    {description || "Drag & drop or click to upload"}
                                </p>
                                <p className="text-xs text-muted-foreground px-4">
                                    {dropzoneProps.accept ? `Supports: ${Object.values(dropzoneProps.accept).flat().join(', ')}` : "Supports common file types"}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {                    }
            {fileRejections.length > 0 && (
                <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                    <HugeiconsIcon icon={InformationCircleIcon} className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.5} color="currentColor" />
                    <div className="space-y-0.5">
                        <span className="font-semibold">File not accepted:</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {fileRejections.map(({ file, errors }) => (
                                <li key={file.name}>
                                    {file.name} - {errors.map(e => e.message).join(', ')}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}
