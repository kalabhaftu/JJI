import { Spinner } from '@/components/ui/spinner'

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { PencilEdit01Icon, Delete02Icon, Add01Icon, Cancel01Icon, Loading01Icon, Upload01Icon } from '@hugeicons/core-free-icons'
import { FileDropzone } from '@/components/ui/file-dropzone'

type ImageField = 'imageOne' | 'imageTwo' | 'imageThree' | 'imageFour' | 'imageFive' | 'imageSix'

interface TradeImagesGalleryProps {
    images: Record<string, string | null>
    onUpload: (field: ImageField, file: File) => void
    onRemove: (field: ImageField) => void
    imageErrors: Record<string, boolean>
    setImageError: (field: string, hasError: boolean) => void
    uploadingField: string | null
}

const IMAGE_FIELDS: ImageField[] = ['imageOne', 'imageTwo', 'imageThree', 'imageFour', 'imageFive', 'imageSix']

export function TradeImagesGallery({
    images,
    onUpload,
    onRemove,
    imageErrors,
    setImageError,
    uploadingField
}: TradeImagesGalleryProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Gallery</h3>
                <p className="text-xs text-muted-foreground">Detailed chart views and execution proofs.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {IMAGE_FIELDS.map((field, idx) => {
                    const imageUrl = images[field]

                    return (
                        <div key={field} className="relative aspect-square rounded-lg overflow-hidden border border-border/50 bg-muted/20 group">
                            {imageUrl && String(imageUrl).trim() !== '' ? (
                                <>
                                    {!imageErrors[field] ? (
                                        <Image
                                            src={imageUrl}
                                            alt={`Screenshot ${idx + 1}`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                            loading="eager"
                                            onError={() => setImageError(field, true)}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-destructive/40" strokeWidth={1.5} color="currentColor" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-background/90 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                                        <InputButton
                                            icon={<HugeiconsIcon icon={PencilEdit01Icon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />}
                                            onClick={(file) => onUpload(field, file)}
                                            className="bg-secondary border-border hover:bg-accent"
                                            title="Edit"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-destructive/90 transition-all scale-90 group-hover:scale-100"
                                            title="Delete"
                                            onClick={() => onRemove(field)}
                                        >
                                            <HugeiconsIcon icon={Delete02Icon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <FileDropzone
                                    variant="mini"
                                    onDrop={(files) => {
                                        const file = files[0]
                                        if (file) onUpload(field, file)
                                    }}
                                    accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
                                    className="h-full w-full bg-muted/30 hover:bg-muted/50 border-dashed"
                                    icon={<HugeiconsIcon icon={Upload01Icon} className="h-4 w-4 text-muted-foreground/40 mb-1" strokeWidth={1.5} color="currentColor" />}
                                    description="Drag or Click"
                                    disabled={uploadingField === field}
                                />
                            )}
                            {uploadingField === field && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <Spinner className="h-4 w-4 text-primary" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function InputButton({ icon, onClick, className, title }: { icon: React.ReactNode, onClick: (file: File) => void, className?: string, title?: string }) {
    return (
        <Button
            type="button"
            variant="secondary"
            size="icon"
            className={`h-8 w-8 rounded-full transition-all scale-90 group-hover:scale-100 ${className}`}
            title={title}
            onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) onClick(file)
                }
                input.click()
            }}
        >
            {icon}
        </Button>
    )
}
